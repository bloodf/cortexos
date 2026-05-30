#!/usr/bin/env bash
# cortex-incus-instance-create.sh — provision ONE CortexOS project-instance.
#
# Single source of truth for creating a project dev container: launch from a
# base image, clone the project repo, wire service proxies, install + start the
# per-instance Hermes profile, and optionally join Tailscale. Idempotent and
# safe to re-run. Used both from the CLI and by the dashboard provisioning
# wizard (invoked through the audited root helper).
#
# This script holds ALL the incus/systemctl command strings for single-instance
# provisioning. scripts/rebuild/apply.sh builds flags and calls this; the
# dashboard builds flags (src/lib/incus/instance-config.ts buildScriptArgv) and
# calls this. Do not duplicate these commands elsewhere.
#
# Mirrors scripts/rebuild/apply.sh phases project-instances + project-hermes-move.
set -Eeuo pipefail

CORTEX_ROOT="${CORTEX_ROOT:-/opt/cortexos}"
PROGRESS_DIR="${CORTEX_INCUS_PROGRESS_DIR:-/run/cortexos/incus-provision}"

# --- defaults (overridable by flags) ---------------------------------------
name=""
slug=""
repo=""
branch="main"
gh_org="${CORTEX_GH_ORG:-bloodf}"
image="cortexos-base/latest"
profiles=()
cpu=""
memory=""
hermes_profile=""
hermes_port=""
hermes_model=""
proxies="9router,honcho,ollama"
bridge="incusbr0"
pool="cortex-zfs"
do_tailscale=0
tailscale_key_ref=""
web_access="direct-tailscale"
force=0
skip_clone=0
skip_hermes=0
dry_run=0
json_progress=0
request_id="${CORTEX_INCUS_REQUEST_ID:-cli-$$}"

# Known service proxy ports (host loopback → instance loopback).
proxy_port_9router=11434
proxy_port_honcho=18690
proxy_port_ollama=11435

usage() {
  cat <<'EOF'
Usage: cortex-incus-instance-create.sh --name NAME [options]

Required:
  --name NAME              Incus instance name (also default slug)

Target:
  --slug SLUG              Project slug (default: NAME)
  --repo URL               Git repo to clone (https or git@) — omit with --skip-clone
  --branch BRANCH          Branch to clone (default: main)
  --gh-org ORG             GitHub org for clone path (default: $CORTEX_GH_ORG or bloodf)

Image & resources:
  --image ALIAS            Base image alias (default: cortexos-base/latest)
  --profile NAME           Extra incus profile (repeatable)
  --cpu N                  limits.cpu
  --memory SIZE            limits.memory (e.g. 4GiB)
  --pool NAME              Storage pool (default: cortex-zfs)

Hermes:
  --hermes-profile NAME    Hermes profile name (enables hermes setup)
  --hermes-port PORT       HERMES_API_PORT for health probe
  --hermes-model ID        Model id recorded for the profile
  --proxies CSV            Subset of 9router,honcho,ollama (default: all)
  --skip-hermes            Do not set up the Hermes profile

Network:
  --bridge NAME            Network bridge (default: incusbr0)
  --tailscale              Join the tailnet after launch
  --tailscale-key-ref NAME Name of the env var holding the TS auth key (never the key)
  --web-access MODE        Recorded web-access mode (default: direct-tailscale)

Behavior:
  --force                  Recreate the instance if it already exists (destructive)
  --skip-clone             Do not clone a repo (new/empty project)
  --dry-run                Print the commands instead of running them
  --json-progress          Emit one JSON object per step to stdout + progress log
  -h, --help               This help
EOF
}

# --- arg parsing ------------------------------------------------------------
while [ $# -gt 0 ]; do
  case "$1" in
    --name) name="$2"; shift 2 ;;
    --slug) slug="$2"; shift 2 ;;
    --repo) repo="$2"; shift 2 ;;
    --branch) branch="$2"; shift 2 ;;
    --gh-org) gh_org="$2"; shift 2 ;;
    --image) image="$2"; shift 2 ;;
    --profile) profiles+=("$2"); shift 2 ;;
    --cpu) cpu="$2"; shift 2 ;;
    --memory) memory="$2"; shift 2 ;;
    --hermes-profile) hermes_profile="$2"; shift 2 ;;
    --hermes-port) hermes_port="$2"; shift 2 ;;
    --hermes-model) hermes_model="$2"; shift 2 ;;
    --proxies) proxies="$2"; shift 2 ;;
    --bridge) bridge="$2"; shift 2 ;;
    --pool) pool="$2"; shift 2 ;;
    --tailscale) do_tailscale=1; shift ;;
    --tailscale-key-ref) tailscale_key_ref="$2"; shift 2 ;;
    --web-access) web_access="$2"; shift 2 ;;
    --force) force=1; shift ;;
    --skip-clone) skip_clone=1; shift ;;
    --skip-hermes) skip_hermes=1; shift ;;
    --dry-run) dry_run=1; shift ;;
    --json-progress) json_progress=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown argument: $1" >&2; usage >&2; exit 2 ;;
  esac
done

[ -n "$slug" ] || slug="$name"

# --- progress + run helpers -------------------------------------------------
TOTAL_STEPS=10
step_no=0

json_escape() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }

emit() {
  # emit <status> <step-id> <message>
  local status="$1" stepid="$2" msg="$3"
  if [ "$json_progress" -eq 1 ]; then
    local line
    line="{\"step\":\"$(json_escape "$stepid")\",\"status\":\"$(json_escape "$status")\",\"n\":$step_no,\"total\":$TOTAL_STEPS,\"detail\":\"$(json_escape "$msg")\"}"
    printf '%s\n' "$line"
    if [ "$dry_run" -eq 0 ]; then
      mkdir -p "$PROGRESS_DIR" 2>/dev/null || true
      printf '%s\n' "$line" >>"$PROGRESS_DIR/$request_id.log" 2>/dev/null || true
    fi
  else
    printf '[incus-create:%d/%d] %s %s %s\n' "$step_no" "$TOTAL_STEPS" "$stepid" "$status" "$msg"
  fi
}

step() { step_no=$((step_no + 1)); emit start "$1" "$2"; }

run() {
  if [ "$dry_run" -eq 1 ]; then
    printf '+ '; printf ' %q' "$@"; printf '\n'
  else
    "$@"
  fi
}

run_shell() {
  if [ "$dry_run" -eq 1 ]; then
    printf '+ bash -lc %q\n' "$1"
  else
    bash -lc "$1" </dev/null
  fi
}

fail() { local code="$1"; shift; emit error "fatal" "$*"; exit "$code"; }

# --- step 1: validate args --------------------------------------------------
step validate-args "checking arguments"
SAFE_NAME_RE='^[a-zA-Z][a-zA-Z0-9_-]{0,62}$'
[[ "$name" =~ $SAFE_NAME_RE ]] || fail 2 "invalid --name: $name"
[[ "$slug" =~ $SAFE_NAME_RE ]] || fail 2 "invalid --slug: $slug"
if [ "$skip_hermes" -eq 0 ]; then
  [ -n "$hermes_profile" ] || fail 2 "--hermes-profile required unless --skip-hermes"
  [[ "$hermes_profile" =~ $SAFE_NAME_RE ]] || fail 2 "invalid --hermes-profile"
  [ -n "$hermes_port" ] || fail 2 "--hermes-port required unless --skip-hermes"
  [[ "$hermes_port" =~ ^[0-9]+$ ]] || fail 2 "invalid --hermes-port"
fi
if [ "$skip_clone" -eq 0 ]; then
  [ -n "$repo" ] || fail 2 "--repo required unless --skip-clone"
fi

# --- step 2: preflight ------------------------------------------------------
step preflight "verifying image, pool, bridge"
run_shell 'sudo -n incus storage show "'"$pool"'" >/dev/null' || fail 3 "storage pool not found: $pool"
run_shell 'sudo -n incus network show "'"$bridge"'" >/dev/null' || fail 3 "network bridge not found: $bridge"
if [ "$dry_run" -eq 0 ]; then
  if ! incus image alias list --format csv 2>/dev/null | grep -q "^${image},"; then
    # image may be specified as alias/tag; fall back to a launch-time check
    if ! sudo -n incus image list --format json 2>/dev/null | grep -q "\"name\":\"${image}\""; then
      emit warn preflight "image alias not found locally: $image (launch may pull/fail)"
    fi
  fi
fi
if [ "$skip_hermes" -eq 0 ]; then
  hermes_env_file="$CORTEX_ROOT/.secrets/hermes/$hermes_profile.env"
  if [ "$dry_run" -eq 0 ] && [ ! -f "$hermes_env_file" ]; then
    fail 3 "missing hermes secret: $hermes_env_file"
  fi
fi

# --- step 3: reset (only if exists + --force) -------------------------------
step reset "checking for existing instance"
exists=0
if [ "$dry_run" -eq 0 ]; then
  state="$(sudo -n incus list "$name" --format csv -c s 2>/dev/null || true)"
  [ -n "$state" ] && exists=1
fi
if [ "$exists" -eq 1 ] && [ "$force" -eq 0 ]; then
  fail 4 "instance $name already exists (use --force to recreate)"
fi
run_shell 'sudo -n incus delete -f "'"$name"'" >/dev/null 2>&1 || true'

# --- step 4: launch ---------------------------------------------------------
step launch "launching $name from $image"
launch_cmd='timeout 300s sudo -n incus launch "'"$image"'" "'"$name"'"'
for p in "${profiles[@]:-}"; do
  [ -n "$p" ] && launch_cmd="$launch_cmd --profile \"$p\""
done
run_shell "$launch_cmd" || fail 4 "incus launch failed"

# --- step 5: wait running ---------------------------------------------------
step wait-running "waiting for RUNNING"
run_shell 'for i in $(seq 1 60); do state=$(sudo -n incus list "'"$name"'" --format csv -c s 2>/dev/null || true); [ "$state" = RUNNING ] && exit 0; sleep 2; done; sudo -n incus info "'"$name"'" || true; exit 1' || fail 4 "instance did not reach RUNNING"

# --- step 6: limits ---------------------------------------------------------
step limits "applying resource limits"
[ -n "$cpu" ] && run_shell 'sudo -n incus config set "'"$name"'" limits.cpu "'"$cpu"'"'
[ -n "$memory" ] && run_shell 'sudo -n incus config set "'"$name"'" limits.memory "'"$memory"'"'

# --- step 7: clone ----------------------------------------------------------
if [ "$skip_clone" -eq 0 ]; then
  step clone "cloning $repo ($branch)"
  tmp_clone="/tmp/cortexos-project-$slug"
  run_shell 'rm -rf "'"$tmp_clone"'" && git clone --depth 1 --branch "'"$branch"'" "'"$repo"'" "'"$tmp_clone"'"' || fail 5 "git clone failed"
  run_shell 'sudo -n incus exec "'"$name"'" -- bash -lc "mkdir -p /home/cortexos/Developer/github/'"$gh_org"'"'
  run_shell 'sudo -n incus file push -r -q "'"$tmp_clone"'" "'"$name"'"/home/cortexos/Developer/github/'"$gh_org"'/' || fail 5 "incus file push failed"
  run_shell 'sudo -n incus exec "'"$name"'" -- bash -lc '"'"'mv /home/cortexos/Developer/github/'"$gh_org"'/cortexos-project-'"$slug"' /home/cortexos/Developer/github/'"$gh_org"'/'"$slug"' 2>/dev/null || true; chown -R cortexos:cortexos /home/cortexos/Developer/github/'"$gh_org"'/'"$slug"''"'"'' || true
  run_shell 'rm -rf "'"$tmp_clone"'"'
else
  step clone "skipping clone (new project)"
fi

# --- step 8: proxies --------------------------------------------------------
step proxies "wiring service proxies"
if [ "$skip_hermes" -eq 0 ]; then
  IFS=',' read -ra proxy_list <<<"$proxies"
  for svc in "${proxy_list[@]}"; do
    svc="$(printf '%s' "$svc" | tr -d ' ')"
    [ -n "$svc" ] || continue
    case "$svc" in
      9router) port="$proxy_port_9router" ;;
      honcho)  port="$proxy_port_honcho" ;;
      ollama)  port="$proxy_port_ollama" ;;
      *) emit warn proxies "unknown proxy: $svc"; continue ;;
    esac
    run_shell 'sudo -n incus config device remove "'"$name"'" proxy-"'"$svc"'" >/dev/null 2>&1 || true'
    run_shell 'sudo -n incus config device add "'"$name"'" proxy-"'"$svc"'" proxy listen=tcp:127.0.0.1:"'"$port"'" connect=tcp:127.0.0.1:"'"$port"'" bind=instance' || fail 6 "proxy add failed: $svc"
  done
fi

# --- step 9: hermes ---------------------------------------------------------
if [ "$skip_hermes" -eq 0 ]; then
  step hermes "installing hermes profile $hermes_profile"
  host_profile_dir="$CORTEX_ROOT/hermes/profiles/$hermes_profile"
  host_env_file="$CORTEX_ROOT/.secrets/hermes/$hermes_profile.env"
  run_shell 'sudo -n incus exec "'"$name"'" -- bash -lc "mkdir -p /opt/cortexos/scripts /opt/cortexos/hermes/profiles/'"$hermes_profile"' /opt/cortexos/.secrets/hermes"'
  run_shell 'sudo -n incus file push -q "'"$CORTEX_ROOT"'/scripts/hermes-profile-api.mjs" "'"$name"'"/opt/cortexos/scripts/'
  run_shell 'sudo -n incus file push -r -q "'"$host_profile_dir"'" "'"$name"'"/opt/cortexos/hermes/profiles/'
  run_shell 'sudo -n incus file push -q "'"$host_env_file"'" "'"$name"'"/opt/cortexos/.secrets/hermes/'
  run_shell 'sudo -n incus exec "'"$name"'" -- bash -lc "chown -R cortexos:cortexos /opt/cortexos/hermes/profiles/'"$hermes_profile"' /opt/cortexos/.secrets/hermes/'"$hermes_profile"'.env /opt/cortexos/scripts/hermes-profile-api.mjs; chmod 600 /opt/cortexos/.secrets/hermes/'"$hermes_profile"'.env"'
  if [ "$dry_run" -eq 1 ]; then
    printf '+ install hermes-profile@%s.service unit\n' "$hermes_profile"
  else
    svc_tmp="$(mktemp /tmp/hermes-profile-XXXXXX.service)"
    cat >"$svc_tmp" <<'UNIT'
[Unit]
Description=CortexOS Hermes profile %i
After=network-online.target
Wants=network-online.target
[Service]
Type=simple
User=cortexos
Group=cortexos
EnvironmentFile=/opt/cortexos/.secrets/hermes/%i.env
Environment=HOME=/home/cortexos
WorkingDirectory=/opt/cortexos/hermes/profiles/%i
ExecStart=/usr/bin/env node /opt/cortexos/scripts/hermes-profile-api.mjs %i
Restart=always
RestartSec=2
[Install]
WantedBy=multi-user.target
UNIT
    sudo -n incus file push -q "$svc_tmp" "$name/etc/systemd/system/hermes-profile@$hermes_profile.service"
    rm -f "$svc_tmp"
  fi
  run_shell 'sudo -n incus exec "'"$name"'" -- systemctl daemon-reload'
  run_shell 'sudo -n incus exec "'"$name"'" -- systemctl enable hermes-profile@'"$hermes_profile"'.service'
  run_shell 'sudo -n incus exec "'"$name"'" -- systemctl start hermes-profile@'"$hermes_profile"'.service'
  run_shell 'for i in $(seq 1 30); do state=$(sudo -n incus exec "'"$name"'" -- systemctl is-active hermes-profile@'"$hermes_profile"'.service 2>/dev/null || true); [ "$state" = active ] && exit 0; sleep 2; done; echo "hermes-profile@'"$hermes_profile"' did not become active"; exit 1' || fail 6 "hermes profile did not become active"
  if [ -n "$hermes_port" ]; then
    run_shell 'sudo -n incus exec "'"$name"'" -- bash -lc "curl -s -o /dev/null -w %{http_code} http://127.0.0.1:'"$hermes_port"'/health 2>/dev/null || true"' || true
  fi
else
  step hermes "skipping hermes setup"
fi

# --- step 10: tailscale -----------------------------------------------------
if [ "$do_tailscale" -eq 1 ]; then
  step tailscale "joining tailnet"
  # The auth key is resolved from the named env var inside the instance/host
  # environment; never passed on the command line or printed.
  if [ -n "$tailscale_key_ref" ]; then
    run_shell 'sudo -n incus exec "'"$name"'" -- env TS_AUTHKEY="${'"$tailscale_key_ref"':-}" cortex-tailscale-up' || emit warn tailscale "tailscale up returned non-zero"
  else
    run_shell 'sudo -n incus exec "'"$name"'" -- cortex-tailscale-up' || emit warn tailscale "tailscale up returned non-zero"
  fi
else
  step tailscale "skipping tailscale join"
fi

emit done complete "instance $name provisioned"
exit 0
