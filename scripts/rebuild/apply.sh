#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
. "$SCRIPT_DIR/lib.sh"

usage() {
  cat <<'USAGE'
Usage: scripts/rebuild/apply.sh --phase retired-runtime --dry-run --backup-dir DIR
       scripts/rebuild/apply.sh --phase retired-runtime --execute --backup-dir DIR
       scripts/rebuild/apply.sh --phase dashboard-root-helper --dry-run --backup-dir DIR
       scripts/rebuild/apply.sh --phase dashboard-root-helper --execute --backup-dir DIR
       scripts/rebuild/apply.sh --phase dashboard-app --dry-run --backup-dir DIR
       scripts/rebuild/apply.sh --phase dashboard-app --execute --backup-dir DIR
       scripts/rebuild/apply.sh --phase obot --dry-run --backup-dir DIR
       scripts/rebuild/apply.sh --phase obot --execute --backup-dir DIR
       scripts/rebuild/apply.sh --phase incus-foundation --dry-run --backup-dir DIR
       scripts/rebuild/apply.sh --phase incus-foundation --execute --backup-dir DIR
       scripts/rebuild/apply.sh --phase incus-base-image --dry-run --backup-dir DIR
       scripts/rebuild/apply.sh --phase incus-base-image --execute --backup-dir DIR
       INCUS_BASE_VARIANT=gastown scripts/rebuild/apply.sh --phase incus-base-image --dry-run --backup-dir DIR
       INCUS_BASE_VARIANT=gastown scripts/rebuild/apply.sh --phase incus-base-image --execute --backup-dir DIR
       scripts/rebuild/apply.sh --phase project-instances --dry-run --backup-dir DIR
       scripts/rebuild/apply.sh --phase project-instances --execute --backup-dir DIR

Apply a guarded rebuild phase. Execution is intentionally phase-scoped.

Options:
  --phase NAME     Phase to apply: retired-runtime, dashboard-root-helper, dashboard-app, obot, incus-foundation, incus-base-image, project-instances.
  --dry-run        Print remote commands without mutating the host.
  --execute        Execute the phase on the host.
  --backup-dir DIR Verified backup directory under /mnt/hdd/cortexos-backups.

Environment:
  INCUS_BASE_VARIANT  For the incus-base-image phase: "" (default) builds the lean
                      cortexos-base image; "gastown" additionally bakes in the gastown
                      multi-agent CLI (Go + beads + Dolt + gt) and publishes
                      cortexos-gastown-base instead.
USAGE
}

phase=""
dry_run=0
execute=0
backup_dir=""

while [ "$#" -gt 0 ]; do
  case "$1" in
    --phase)
      phase="${2:-}"
      [ -n "$phase" ] || die "--phase requires a value"
      shift 2
      ;;
    --dry-run)
      dry_run=1
      shift
      ;;
    --execute)
      execute=1
      shift
      ;;
    --backup-dir)
      backup_dir="${2:-}"
      [ -n "$backup_dir" ] || die "--backup-dir requires a directory"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      die "unknown argument: $1"
      ;;
  esac
done

[ -n "$phase" ] || die "--phase is required"
if [ "$dry_run" -eq "$execute" ]; then
  die "choose exactly one of --dry-run or --execute"
fi
[ -n "$backup_dir" ] || die "--backup-dir is required"

case "$phase" in
  retired-runtime|dashboard-root-helper|dashboard-app|obot|incus-foundation|incus-base-image|project-instances|project-hermes-move) ;;
  *) die "unsupported phase: $phase" ;;
esac

incus_base_variant="${INCUS_BASE_VARIANT:-}"
case "$incus_base_variant" in
  ""|gastown) ;;
  *) die "unsupported INCUS_BASE_VARIANT: $incus_base_variant (expected \"\" or gastown)" ;;
esac

"$SCRIPT_DIR/validate.sh" --local >/dev/null
"$SCRIPT_DIR/restore.sh" --verify-remote "$backup_dir" >/dev/null

backup_dir_q="$(printf '%q' "$backup_dir")"

write_section "Phase"
printf '%s\n' "$phase"

write_section "Verified Backup"
printf '%s\n' "$backup_dir"

if [ "$phase" = "dashboard-root-helper" ]; then
  helper_archive="$(mktemp -t cortexos-dashboard-helper.XXXXXX.tgz)"
  remote_archive="/tmp/cortexos-dashboard-helper.tgz"
  trap 'rm -f "$helper_archive"' EXIT

  COPYFILE_DISABLE=1 tar --no-xattrs -C "$REBUILD_ROOT" -czf "$helper_archive" \
    stacks/cortex-dashboard-root-helper \
    packages/cortex-dashboard/migrations/018_dashboard_command_audit.sql \
    packages/cortex-dashboard/migrations/018_dashboard_command_audit.rollback.sql \
    manifests/rebuild/dashboard-helper-audit.sql \
    manifests/rebuild/dashboard-helper-log-format.json

  scp -q "$helper_archive" "$CORTEX_HOST:$remote_archive"

  remote_script="$(mktemp)"
  trap 'rm -f "$helper_archive" "$remote_script"' EXIT
  cat >"$remote_script" <<'REMOTE'
set -Eeuo pipefail

mode="${MODE:?}"
backup_dir="${BACKUP_DIR:?}"
archive="${HELPER_ARCHIVE:?}"

log() {
  printf '[apply:%s] %s\n' "$mode" "$*"
}

run() {
  if [ "$mode" = "dry-run" ]; then
    printf '+'
    printf ' %q' "$@"
    printf '\n'
  else
    "$@"
  fi
}

run_shell() {
  local command="$1"
  if [ "$mode" = "dry-run" ]; then
    printf '+ bash -lc %q\n' "$command"
  else
    bash -lc "$command" </dev/null
  fi
}

test -d "$backup_dir"
test -s "$backup_dir/SHA256SUMS"
test -s "$backup_dir/archives/hermes.tgz"
test -s "$backup_dir/archives/secrets.tgz"

if sudo -n true 2>/dev/null; then
  sudo_cmd=(sudo -n)
else
  sudo_cmd=()
fi

run "${sudo_cmd[@]}" mkdir -p /opt/cortexos
run "${sudo_cmd[@]}" tar -xzf "$archive" -C /opt/cortexos
run "${sudo_cmd[@]}" chown -R cortexos:cortexos /opt/cortexos/stacks/cortex-dashboard-root-helper
run_shell 'if [ -f /opt/cortexos/.secrets/dashboard.env ] && command -v psql >/dev/null 2>&1; then
  set -a
  # shellcheck disable=SC1091
  . /opt/cortexos/.secrets/dashboard.env
  set +a
  export PGPASSWORD="${DB_PASSWORD:?}"
  psql -v ON_ERROR_STOP=1 \
    -h "${DB_HOST:-127.0.0.1}" \
    -p "${DB_PORT:-5432}" \
    -U "${DB_USER:-dashboard}" \
    -d "${DB_NAME:-cortex_dashboard}" \
    -f /opt/cortexos/packages/cortex-dashboard/migrations/018_dashboard_command_audit.sql
else
  echo "dashboard audit migration skipped: missing dashboard.env or psql"
fi'
run "${sudo_cmd[@]}" install -o root -g root -m 0644 \
  /opt/cortexos/stacks/cortex-dashboard-root-helper/cortex-dashboard-root-helper.socket \
  /etc/systemd/system/cortex-dashboard-root-helper.socket
run "${sudo_cmd[@]}" install -o root -g root -m 0644 \
  /opt/cortexos/stacks/cortex-dashboard-root-helper/cortex-dashboard-root-helper.service \
  /etc/systemd/system/cortex-dashboard-root-helper.service
run "${sudo_cmd[@]}" systemctl daemon-reload
run "${sudo_cmd[@]}" systemctl enable --now cortex-dashboard-root-helper.socket
run "${sudo_cmd[@]}" systemctl restart cortex-dashboard-root-helper.socket
run "${sudo_cmd[@]}" systemctl restart cortex-dashboard-root-helper.service
run_shell 'python3 - <<'"'"'PY'"'"'
import json
import socket
import uuid

req = {
    "request_id": str(uuid.uuid4()),
    "command": "/bin/true",
    "argv": [],
    "cwd": "/",
    "timeout_ms": 10000,
    "requested_by": "rebuild-apply",
    "mutation_class": "validation",
    "target_scope": "host",
    "metadata": {"phase": "dashboard-root-helper"},
}
client = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
client.settimeout(10)
client.connect("/run/cortexos/dashboard-helper.sock")
client.sendall(json.dumps(req).encode("utf-8") + b"\n")
data = client.recv(65536)
response = json.loads(data.decode("utf-8"))
print(json.dumps(response, sort_keys=True))
if response.get("status") != "succeeded" or response.get("exit_code") != 0:
    raise SystemExit(1)
PY'
run "${sudo_cmd[@]}" systemctl is-active cortex-dashboard-root-helper.socket
run "${sudo_cmd[@]}" systemctl is-active cortex-dashboard-root-helper.service
log "completed $mode"
REMOTE

  if [ "$dry_run" -eq 1 ]; then
    mode="dry-run"
  else
    mode="execute"
  fi

  ssh_host "MODE=$mode BACKUP_DIR=$backup_dir_q HELPER_ARCHIVE=$remote_archive bash -s" <"$remote_script"
  exit 0
fi

if [ "$phase" = "dashboard-app" ]; then
  dashboard_archive="$(mktemp -t cortexos-dashboard-app.XXXXXX.tgz)"
  remote_archive="/tmp/cortexos-dashboard-app.tgz"
  trap 'rm -f "$dashboard_archive"' EXIT

  COPYFILE_DISABLE=1 tar --no-xattrs \
    --exclude '*/node_modules' \
    --exclude '*/.next' \
    --exclude '*/.turbo' \
    --exclude '*/.DS_Store' \
    --exclude '*/tsconfig.tsbuildinfo' \
    -C "$REBUILD_ROOT" -czf "$dashboard_archive" \
    package.json \
    pnpm-lock.yaml \
    pnpm-workspace.yaml \
    packages/cortex-audit \
    packages/cortex-dashboard \
    stacks/cortex-dashboard

  scp -q "$dashboard_archive" "$CORTEX_HOST:$remote_archive"

  remote_script="$(mktemp)"
  trap 'rm -f "$dashboard_archive" "$remote_script"' EXIT
  cat >"$remote_script" <<'REMOTE'
set -Eeuo pipefail

mode="${MODE:?}"
backup_dir="${BACKUP_DIR:?}"
archive="${DASHBOARD_ARCHIVE:?}"

log() {
  printf '[apply:%s] %s\n' "$mode" "$*"
}

run() {
  if [ "$mode" = "dry-run" ]; then
    printf '+'
    printf ' %q' "$@"
    printf '\n'
  else
    "$@"
  fi
}

run_shell() {
  local command="$1"
  if [ "$mode" = "dry-run" ]; then
    printf '+ bash -lc %q\n' "$command"
  else
    bash -lc "$command" </dev/null
  fi
}

test -d "$backup_dir"
test -s "$backup_dir/SHA256SUMS"
test -s "$backup_dir/archives/hermes.tgz"
test -s "$backup_dir/archives/secrets.tgz"

if sudo -n true 2>/dev/null; then
  sudo_cmd=(sudo -n)
else
  sudo_cmd=()
fi

run "${sudo_cmd[@]}" mkdir -p /opt/cortexos/packages /opt/cortexos/stacks
run "${sudo_cmd[@]}" rm -rf \
  /opt/cortexos/packages/cortex-audit \
  /opt/cortexos/packages/cortex-dashboard \
  /opt/cortexos/stacks/cortex-dashboard
run "${sudo_cmd[@]}" tar -xzf "$archive" -C /opt/cortexos
run "${sudo_cmd[@]}" chown -R cortexos:cortexos \
  /opt/cortexos/package.json \
  /opt/cortexos/pnpm-lock.yaml \
  /opt/cortexos/pnpm-workspace.yaml \
  /opt/cortexos/packages/cortex-audit \
  /opt/cortexos/packages/cortex-dashboard \
  /opt/cortexos/stacks/cortex-dashboard
run_shell 'cd /opt/cortexos && sudo -u cortexos bash scripts/ops/cortex-dashboard-build.sh'
run_shell 'cd /opt/cortexos && bash scripts/ops/cortex-render-units.sh cortex-dashboard.service'
run_shell 'systemctl enable --now cortex-dashboard.service'
run_shell 'for i in $(seq 1 30); do curl -fsS http://127.0.0.1:3080/en/login >/dev/null && exit 0; sleep 2; done; exit 1'
run_shell 'systemctl is-active cortex-dashboard.service'
log "completed $mode"
REMOTE

  if [ "$dry_run" -eq 1 ]; then
    mode="dry-run"
  else
    mode="execute"
  fi

  ssh_host "MODE=$mode BACKUP_DIR=$backup_dir_q DASHBOARD_ARCHIVE=$remote_archive bash -s" <"$remote_script"
  exit 0
fi

if [ "$phase" = "obot" ]; then
  obot_archive="$(mktemp -t cortexos-obot.XXXXXX.tgz)"
  remote_archive="/tmp/cortexos-obot.tgz"
  trap 'rm -f "$obot_archive"' EXIT
  COPYFILE_DISABLE=1 tar --no-xattrs \
    --exclude '*/node_modules' \
    --exclude '*/__pycache__' \
    --exclude '*/.DS_Store' \
    -C "$REBUILD_ROOT" -czf "$obot_archive" \
    stacks/cortex-obot
  scp -q "$obot_archive" "$CORTEX_HOST:$remote_archive"
  remote_script="$(mktemp)"
  trap 'rm -f "$obot_archive" "$remote_script"' EXIT
  cat >"$remote_script" <<'REMOTE'
set -Eeuo pipefail
mode="${MODE:?}"
backup_dir="${BACKUP_DIR:?}"
archive="${OBOT_ARCHIVE:?}"
log() {
  printf '[apply:%s] %s\n' "$mode" "$*"
}
run() {
  if [ "$mode" = "dry-run" ]; then
    printf '+'
    printf ' %q' "$@"
    printf '\n'
  else
    "$@"
  fi
}
test -d "$backup_dir"
test -s "$backup_dir/SHA256SUMS"
test -s "$backup_dir/archives/hermes.tgz"
test -s "$backup_dir/archives/secrets.tgz"
if sudo -n true 2>/dev/null; then
  sudo_cmd=(sudo -n)
else
  sudo_cmd=()
fi
run "${sudo_cmd[@]}" rm -rf /opt/cortexos/stacks/cortex-obot
run "${sudo_cmd[@]}" mkdir -p /opt/cortexos/stacks
run "${sudo_cmd[@]}" tar -xzf "$archive" -C /opt/cortexos
run "${sudo_cmd[@]}" chown -R cortexos:cortexos /opt/cortexos/stacks/cortex-obot
# Stop and remove old agentgateway if present
if systemctl is-active cortex-agentgateway.service >/dev/null 2>&1; then
  run "${sudo_cmd[@]}" systemctl stop cortex-agentgateway.service
fi
if [ -f /etc/systemd/system/cortex-agentgateway.service ]; then
  run "${sudo_cmd[@]}" rm /etc/systemd/system/cortex-agentgateway.service
  run "${sudo_cmd[@]}" systemctl daemon-reload
fi
log "completed $mode (docker compose up handled by spoke 50-obot)"
REMOTE
  if [ "$dry_run" -eq 1 ]; then
    mode="dry-run"
  else
    mode="execute"
  fi
  ssh_host "MODE=$mode BACKUP_DIR=$backup_dir_q OBOT_ARCHIVE=$remote_archive bash -s" <"$remote_script"
  exit 0
fi

if [ "$phase" = "incus-foundation" ]; then
  incus_archive="$(mktemp -t cortexos-incus-foundation.XXXXXX.tgz)"
  remote_archive="/tmp/cortexos-incus-foundation.tgz"
  remote_script="$(mktemp)"
  trap 'rm -f "$incus_archive" "$remote_script"' EXIT

  COPYFILE_DISABLE=1 tar --no-xattrs -C "$REBUILD_ROOT" -czf "$incus_archive" \
    stacks/cortex-incus

  scp -q "$incus_archive" "$CORTEX_HOST:$remote_archive"

  cat >"$remote_script" <<'REMOTE'
set -Eeuo pipefail

mode="${MODE:?}"
backup_dir="${BACKUP_DIR:?}"
archive="${INCUS_ARCHIVE:?}"
pool_name="${INCUS_POOL_NAME:-cortex-zfs}"
pool_source="${INCUS_POOL_SOURCE:-/mnt/hdd/incus-zfs.img}"
pool_source_dir="$(dirname "$pool_source")"
pool_size="${INCUS_POOL_SIZE:-300GiB}"
bridge_name="${INCUS_BRIDGE_NAME:-incusbr0}"
bridge_ipv4="${INCUS_BRIDGE_IPV4:-<bridge-cidr>}"
egress_if="$(ip route show default 0.0.0.0/0 2>/dev/null | awk '{print $5; exit}')"
smoke_name="${INCUS_SMOKE_NAME:-cortex-incus-smoke}"
smoke_image="${INCUS_SMOKE_IMAGE:-images:ubuntu/26.04}"

log() {
  printf '[apply:%s] %s\n' "$mode" "$*"
}

run() {
  if [ "$mode" = "dry-run" ]; then
    printf '+'
    printf ' %q' "$@"
    printf '\n'
  else
    "$@"
  fi
}

run_shell() {
  local command="$1"
  if [ "$mode" = "dry-run" ]; then
    printf '+ bash -lc %q\n' "$command"
  else
    bash -lc "$command" </dev/null
  fi
}

test -d "$backup_dir"
test -s "$backup_dir/SHA256SUMS"
test -s "$backup_dir/archives/hermes.tgz"
test -s "$backup_dir/archives/secrets.tgz"
test -d /mnt/hdd

if sudo -n true 2>/dev/null; then
  sudo_cmd=(sudo -n)
else
  sudo_cmd=()
fi

run "${sudo_cmd[@]}" apt-get update
run "${sudo_cmd[@]}" apt-get install -y incus incus-client zfsutils-linux
run "${sudo_cmd[@]}" systemctl enable --now incus.service
run "${sudo_cmd[@]}" modprobe zfs
run_shell 'if getent group incus-admin >/dev/null; then sudo -n usermod -aG incus-admin cortexos; fi'
run_shell 'if ! sudo -n incus profile show default >/dev/null 2>&1; then sudo -n incus admin init --minimal; fi'
run "${sudo_cmd[@]}" mkdir -p /opt/cortexos/stacks
run "${sudo_cmd[@]}" rm -rf /opt/cortexos/stacks/cortex-incus
run "${sudo_cmd[@]}" tar -xzf "$archive" -C /opt/cortexos
run "${sudo_cmd[@]}" chown -R cortexos:cortexos /opt/cortexos/stacks/cortex-incus
run_shell 'if ! sudo -n zpool list -H "'"$pool_name"'" >/dev/null 2>&1; then
  if sudo -n zpool import -N -d "'"$pool_source_dir"'" "'"$pool_name"'" >/dev/null 2>&1; then
    :
  else
    sudo -n install -d -m 0755 "'"$pool_source_dir"'"
    if [ -e "'"$pool_source"'" ] && [ -s "'"$pool_source"'" ]; then
      echo "backing file exists but zpool import failed: '"$pool_source"'" >&2
      exit 1
    fi
    sudo -n truncate -s "'"$pool_size"'" "'"$pool_source"'"
    sudo -n zpool create -f -o ashift=12 -O compression=lz4 -O atime=off -O mountpoint=none "'"$pool_name"'" "'"$pool_source"'"
  fi
fi'
run_shell 'sudo -n zpool list "'"$pool_name"'"'
run_shell 'sudo -n zfs set compression=lz4 "'"$pool_name"'"'
run_shell 'sudo -n zfs set atime=off "'"$pool_name"'"'
run_shell 'sudo -n zfs set mountpoint=none "'"$pool_name"'"'
run_shell 'sed -e "s|@@POOL_NAME@@|'"$pool_name"'|g" -e "s|@@POOL_SOURCE_DIR@@|'"$pool_source_dir"'|g" /opt/cortexos/stacks/cortex-incus/cortex-incus-zpool.service.in | sudo -n tee /etc/systemd/system/cortex-incus-zpool.service >/dev/null'
run "${sudo_cmd[@]}" install -d -o root -g root -m 0755 /etc/systemd/system/incus.service.d
run "${sudo_cmd[@]}" install -o root -g root -m 0644 \
  /opt/cortexos/stacks/cortex-incus/10-cortex-zfs.conf \
  /etc/systemd/system/incus.service.d/10-cortex-zfs.conf
run "${sudo_cmd[@]}" systemctl daemon-reload
run "${sudo_cmd[@]}" systemctl enable --now cortex-incus-zpool.service
run_shell 'if ! sudo -n incus storage show "'"$pool_name"'" >/dev/null 2>&1; then sudo -n incus storage create "'"$pool_name"'" zfs source="'"$pool_name"'"; fi'
run_shell 'if ! sudo -n incus network show "'"$bridge_name"'" >/dev/null 2>&1; then sudo -n incus network create "'"$bridge_name"'" ipv4.address="'"$bridge_ipv4"'" ipv4.nat=true ipv6.address=none; fi'
run_shell 'if command -v ufw >/dev/null 2>&1 && sudo -n ufw status | grep -q "Status: active"; then
  sudo -n ufw allow in on "'"$bridge_name"'" proto udp to any port 67 comment "CortexOS Incus DHCP"
  sudo -n ufw allow in on "'"$bridge_name"'" proto udp to any port 53 comment "CortexOS Incus DNS"
  sudo -n ufw allow in on "'"$bridge_name"'" proto tcp to any port 53 comment "CortexOS Incus DNS TCP"
  if [ -n "'"$egress_if"'" ]; then
    sudo -n ufw route allow in on "'"$bridge_name"'" out on "'"$egress_if"'" comment "CortexOS Incus egress"
  fi
  if ip link show tailscale0 >/dev/null 2>&1; then
    sudo -n ufw route allow in on "'"$bridge_name"'" out on tailscale0 comment "CortexOS Incus tailnet egress"
  fi
  sudo -n ufw reload
fi'
run_shell 'if ! sudo -n incus profile device get default root path >/dev/null 2>&1; then sudo -n incus profile device add default root disk path=/ pool="'"$pool_name"'"; else sudo -n incus profile device set default root pool "'"$pool_name"'"; sudo -n incus profile device set default root path /; fi'
run_shell 'if ! sudo -n incus profile device get default eth0 network >/dev/null 2>&1; then sudo -n incus profile device add default eth0 nic name=eth0 network="'"$bridge_name"'"; else sudo -n incus profile device set default eth0 network "'"$bridge_name"'"; sudo -n incus profile device set default eth0 name eth0; fi'
# security.nesting=true: required so systemd inside the container can manage
# (kill/restart) its own service cgroups. Without it, cgroup.kill is denied,
# a crashed service cannot be reaped, and units that bind a port enter an
# EADDRINUSE restart loop (observed on the project Hermes profiles).
run_shell 'sudo -n incus profile set default security.nesting true'
run_shell 'timeout 300s sudo -n incus launch "'"$smoke_image"'" "'"$smoke_name"'"'
run_shell 'for i in $(seq 1 60); do state=$(sudo -n incus list "'"$smoke_name"'" --format csv -c s 2>/dev/null || true); [ "$state" = RUNNING ] && exit 0; sleep 2; done; sudo -n incus info "'"$smoke_name"'" || true; exit 1'
run_shell 'sudo -n incus exec "'"$smoke_name"'" -- sh -lc '"'"'. /etc/os-release && printf "%s %s\n" "$ID" "$VERSION_ID"'"'"''
run_shell 'timeout 180s sudo -n incus delete -f "'"$smoke_name"'"'
run_shell 'sudo -n incus storage list; sudo -n incus network list; sudo -n incus profile show default'
log "completed $mode"
REMOTE

  if [ "$dry_run" -eq 1 ]; then
    mode="dry-run"
  else
    mode="execute"
  fi

  ssh_host "MODE=$mode BACKUP_DIR=$backup_dir_q INCUS_ARCHIVE=$remote_archive bash -s" <"$remote_script"
  exit 0
fi

if [ "$phase" = "incus-base-image" ]; then
  incus_archive="$(mktemp -t cortexos-incus-base.XXXXXX.tgz)"
  remote_archive="/tmp/cortexos-incus-base.tgz"
  remote_script="$(mktemp)"
  trap 'rm -f "$incus_archive" "$remote_script"' EXIT

  COPYFILE_DISABLE=1 tar --no-xattrs -C "$REBUILD_ROOT" -czf "$incus_archive" \
    stacks/cortex-incus \
    manifests/rebuild/tmux-plugins.txt

  scp -q "$incus_archive" "$CORTEX_HOST:$remote_archive"

  cat >"$remote_script" <<'REMOTE'
set -Eeuo pipefail

mode="${MODE:?}"
backup_dir="${BACKUP_DIR:?}"
archive="${INCUS_ARCHIVE:?}"
builder="${INCUS_BASE_BUILDER:-cortex-base-build}"
smoke_name="${INCUS_BASE_SMOKE_NAME:-cortex-base-smoke}"
source_image="${INCUS_BASE_SOURCE_IMAGE:-images:ubuntu/26.04}"
variant="${INCUS_BASE_VARIANT:-}"

if [ "$variant" = "gastown" ]; then
  image_prefix="cortexos-gastown-base"
  image_description="CortexOS gastown + Hermes base image"
else
  image_prefix="cortexos-base"
  image_description="CortexOS Ubuntu 26.04 AI agent base image"
fi

version_alias="${INCUS_BASE_VERSION_ALIAS:-$image_prefix/ubuntu-26.04-$(date -u +%Y%m%d)}"
latest_alias="${INCUS_BASE_LATEST_ALIAS:-$image_prefix/latest}"
alias_grep="${image_prefix}/(latest|ubuntu-26.04)"

log() {
  printf '[apply:%s] %s\n' "$mode" "$*"
}

run() {
  if [ "$mode" = "dry-run" ]; then
    printf '+'
    printf ' %q' "$@"
    printf '\n'
  else
    "$@"
  fi
}

run_shell() {
  local command="$1"
  if [ "$mode" = "dry-run" ]; then
    printf '+ bash -lc %q\n' "$command"
  else
    bash -lc "$command" </dev/null
  fi
}

test -d "$backup_dir"
test -s "$backup_dir/SHA256SUMS"
test -s "$backup_dir/archives/hermes.tgz"
test -s "$backup_dir/archives/secrets.tgz"

if sudo -n true 2>/dev/null; then
  sudo_cmd=(sudo -n)
else
  sudo_cmd=()
fi

# On a failed execute, the builder is launched with zfs sync=disabled (for build
# speed) and is normally reset to sync=standard before publish. If the phase dies
# in between, restore the safe sync setting. The builder itself is left running
# for inspection — the next run's `incus delete -f` reclaims it.
cleanup_on_exit() {
  local rc=$?
  [ "$mode" = "execute" ] && [ "$rc" -ne 0 ] || return 0
  set +e
  if sudo -n zfs list "cortex-zfs/containers/$builder" >/dev/null 2>&1; then
    sudo -n zfs set sync=standard "cortex-zfs/containers/$builder" 2>/dev/null || true
  fi
  # The smoke instance is built from the already-published image, so it has no
  # debug value — reclaim it. The builder IS left for inspection (its provisioning
  # is the expensive, debuggable part); the next run's `incus delete -f` reclaims it.
  sudo -n incus delete -f "$smoke_name" >/dev/null 2>&1 || true
  log "phase failed (rc=$rc); restored zfs sync=standard, removed $smoke_name, left $builder for inspection"
}
trap cleanup_on_exit EXIT

run_shell 'sudo -n incus storage show cortex-zfs >/dev/null'
run_shell 'sudo -n incus network show incusbr0 >/dev/null'
run_shell 'sudo -n incus delete -f "'"$smoke_name"'" >/dev/null 2>&1 || true'
run_shell 'sudo -n incus delete -f "'"$builder"'" >/dev/null 2>&1 || true'
run_shell 'timeout 300s sudo -n incus launch "'"$source_image"'" "'"$builder"'"'
run_shell 'for i in $(seq 1 60); do state=$(sudo -n incus list "'"$builder"'" --format csv -c s 2>/dev/null || true); [ "$state" = RUNNING ] && exit 0; sleep 2; done; sudo -n incus info "'"$builder"'" || true; exit 1'
run_shell 'if sudo -n zfs list "cortex-zfs/containers/'"$builder"'" >/dev/null 2>&1; then sudo -n zfs set sync=disabled "cortex-zfs/containers/'"$builder"'"; fi'
run_shell 'sudo -n incus file push "'"$archive"'" "'"$builder"'/tmp/cortexos-incus-base.tgz"'
run_shell 'sudo -n incus exec "'"$builder"'" -- bash -lc "rm -rf /opt/cortexos-incus && mkdir -p /opt/cortexos-incus && tar -xzf /tmp/cortexos-incus-base.tgz -C /opt/cortexos-incus"'
run_shell 'sudo -n incus exec "'"$builder"'" -- bash /opt/cortexos-incus/stacks/cortex-incus/base-image-provision.sh'
if [ "$variant" = "gastown" ]; then
  # base-image-provision.sh removes /opt/cortexos-incus (its clean-image step), so
  # re-push + re-extract the stack archive before running the gastown layer. rm the
  # prior push first: the existing copy may be owned by a different (idmapped) uid,
  # and `incus file push` can fail to overwrite it ("permission denied").
  run_shell 'sudo -n incus exec "'"$builder"'" -- rm -f /tmp/cortexos-incus-base.tgz'
  run_shell 'sudo -n incus file push "'"$archive"'" "'"$builder"'/tmp/cortexos-incus-base.tgz"'
  run_shell 'sudo -n incus exec "'"$builder"'" -- bash -lc "rm -rf /opt/cortexos-incus && mkdir -p /opt/cortexos-incus && tar -xzf /tmp/cortexos-incus-base.tgz -C /opt/cortexos-incus"'
  run_shell 'sudo -n incus exec "'"$builder"'" -- bash /opt/cortexos-incus/stacks/cortex-incus/gastown-provision.sh'
fi
run_shell 'sudo -n incus exec "'"$builder"'" -- sudo -H -u cortexos bash -lc '"'"'source ~/.profile; command -v codex pi omp oh-pi claude cursor cursor-agent hermes cortex-tmux cortex-tailscale-up cortex-host-health; tmux -V; zsh --version; tailscale version | head -5'"'"''
if [ "$variant" = "gastown" ]; then
  run_shell 'sudo -n incus exec "'"$builder"'" -- sudo -H -u cortexos bash -lc '"'"'cd ~; source ~/.profile; set -eo pipefail; command -v go dolt bd gt; go version; dolt version | head -3; gt --version || gt --help | head -5'"'"''
fi
run_shell 'sudo -n incus exec "'"$builder"'" -- rm -f /tmp/cortexos-incus-base.tgz'
run_shell 'if sudo -n zfs list "cortex-zfs/containers/'"$builder"'" >/dev/null 2>&1; then sudo -n zfs set sync=standard "cortex-zfs/containers/'"$builder"'"; fi'
run_shell 'timeout 180s sudo -n incus stop -f "'"$builder"'"'
run_shell 'sudo -n incus image alias delete "'"$latest_alias"'" >/dev/null 2>&1 || true'
run_shell 'sudo -n incus image alias delete "'"$version_alias"'" >/dev/null 2>&1 || true'
run_shell 'sudo -n incus publish "'"$builder"'" --alias "'"$version_alias"'" --alias "'"$latest_alias"'" description="'"$image_description"'"'
run_shell 'sudo -n incus delete -f "'"$builder"'"'
run_shell 'timeout 300s sudo -n incus launch "'"$latest_alias"'" "'"$smoke_name"'"'
run_shell 'for i in $(seq 1 60); do state=$(sudo -n incus list "'"$smoke_name"'" --format csv -c s 2>/dev/null || true); [ "$state" = RUNNING ] && exit 0; sleep 2; done; sudo -n incus info "'"$smoke_name"'" || true; exit 1'
run_shell 'sudo -n incus exec "'"$smoke_name"'" -- sudo -H -u cortexos bash -lc '"'"'source ~/.profile; printf "user=%s\n" "$(whoami)"; codex --version; claude --version; pi --version || pi --help | head -5; omp --version || omp --help | head -5; cursor --version || true; hermes --version || hermes --help | head -5; cortex-host-health --local-only; systemctl is-enabled tailscaled || true'"'"''
if [ "$variant" = "gastown" ]; then
  run_shell 'sudo -n incus exec "'"$smoke_name"'" -- sudo -H -u cortexos bash -lc '"'"'cd ~; source ~/.profile; set -eo pipefail; command -v go dolt bd gt; go version; dolt version | head -3; gt --version || gt --help | head -5; test -d /gt/.dolt-data && echo "dolt-data dir present"'"'"''
fi
run_shell 'timeout 180s sudo -n incus delete -f "'"$smoke_name"'"'
run_shell 'sudo -n incus image alias list | grep -E "'"$alias_grep"'"'
log "completed $mode"
REMOTE

  if [ "$dry_run" -eq 1 ]; then
    mode="dry-run"
  else
    mode="execute"
  fi

  ssh_host "MODE=$mode BACKUP_DIR=$backup_dir_q INCUS_ARCHIVE=$remote_archive INCUS_BASE_VARIANT=$(printf '%q' "$incus_base_variant") bash -s" <"$remote_script"
  # The scp'd host-side archive is not covered by the local trap above; remove it.
  ssh_host "rm -f $remote_archive" >/dev/null 2>&1 || true
  exit 0
fi

if [ "$phase" = "project-instances" ]; then
  projects_manifest="$(require_manifest projects.tsv)"
  remote_script="$(mktemp)"
  trap 'rm -f "$remote_script"' EXIT

  cat >"$remote_script" <<'REMOTE'
set -Eeuo pipefail

mode="${MODE:?}"
backup_dir="${BACKUP_DIR:?}"
projects_manifest="${PROJECTS_MANIFEST:?}"
base_alias="${PROJECT_BASE_ALIAS:-cortexos-base/latest}"

log() {
  printf '[apply:%s] %s\n' "$mode" "$*"
}

run_shell() {
  local command="$1"
  if [ "$mode" = "dry-run" ]; then
    printf '+ bash -lc %q\n' "$command"
  else
    bash -lc "$command" </dev/null
  fi
}

test -d "$backup_dir"
test -s "$backup_dir/SHA256SUMS"
test -s "$backup_dir/archives/hermes.tgz"
test -s "$backup_dir/archives/secrets.tgz"

run_shell 'sudo -n incus image alias list | grep -q "cortexos-base/latest" || { echo "missing base image: cortexos-base/latest"; exit 1; }'

project_count=0
project_ok=0

while IFS=$'\t' read -r slug repo instance hermes_profile migration_source data_mode web_access status; do
  case "$slug" in
    ""|\#*) continue ;;
  esac

  project_count=$((project_count + 1))
  log "project $project_count: slug=$slug instance=$instance repo=$repo"

  run_shell 'sudo -n incus delete -f "'"$instance"'" >/dev/null 2>&1 || true'
  run_shell 'timeout 300s sudo -n incus launch "'"$base_alias"'" "'"$instance"'"'
  run_shell 'for i in $(seq 1 60); do state=$(sudo -n incus list "'"$instance"'" --format csv -c s 2>/dev/null || true); [ "$state" = RUNNING ] && exit 0; sleep 2; done; sudo -n incus info "'"$instance"'" || true; exit 1'

  tmp_clone="/tmp/cortexos-project-$slug"
  run_shell 'rm -rf "'"$tmp_clone"'" && git clone --depth 1 --branch main '"$repo"' "'"$tmp_clone"'"'
  run_shell 'mv "'"$tmp_clone"'" /tmp/'"$slug"''
  run_shell 'sudo -n incus file push -r -q /tmp/'"$slug"' "'"$instance"'"/home/cortexos/Developer/github/'"${CORTEX_GH_ORG:-bloodf}"'/'
  run_shell 'rm -rf /tmp/'"$slug"''
  run_shell 'sudo -n incus exec "'"$instance"'" -- bash -lc '"'"'chown -R cortexos:cortexos /home/cortexos/Developer/github/'"${CORTEX_GH_ORG:-bloodf}"'/'"$slug"''"'"''

  run_shell 'sudo -n incus exec "'"$instance"'" -- sudo -H -u cortexos bash -lc '"'"'cd /home/cortexos/Developer/github/'"${CORTEX_GH_ORG:-bloodf}"'/'"$slug"' && git log -1 --oneline && printf "%s\n" "clean-clone-ok"'"'"''

  log "project $slug instance ready"
  project_ok=$((project_ok + 1))
done <"$projects_manifest"

log "projects: $project_ok/$project_count ready"
if [ "$project_ok" -ne "$project_count" ]; then
  log "ERROR: not all projects validated"
  exit 1
fi
log "completed $mode"
REMOTE

  if [ "$dry_run" -eq 1 ]; then
    mode="dry-run"
  else
    mode="execute"
  fi

  scp -q "$projects_manifest" "$CORTEX_HOST:/tmp/cortexos-projects.tsv"
  ssh_host "MODE=$mode BACKUP_DIR=$backup_dir_q PROJECTS_MANIFEST=/tmp/cortexos-projects.tsv bash -s" <"$remote_script"
  exit 0
fi
if [ "$phase" = "project-hermes-move" ]; then
  projects_manifest="$(require_manifest projects.tsv)"
  remote_script="$(mktemp)"
  trap 'rm -f "$remote_script"' EXIT

  cat >"$remote_script" <<'REMOTE'
set -Eeuo pipefail
mode="${MODE:?}"
backup_dir="${BACKUP_DIR:?}"
projects_manifest="${PROJECTS_MANIFEST:?}"
log() { printf '[apply:%s] %s\n' "$mode" "$*"; }
run_shell() {
  local command="$1"
  if [ "$mode" = "dry-run" ]; then printf '+ bash -lc %q\n' "$command";
  else bash -lc "$command" </dev/null; fi
}
project_count=0
project_ok=0
while IFS=$'\t' read -r slug repo instance hermes_profile migration_source data_mode web_access status; do
  case "$slug" in ""|\#*) continue ;; esac
  project_count=$((project_count + 1))
  log "project $project_count: slug=$slug instance=$instance profile=$hermes_profile"
  host_profile_dir="/opt/cortexos/hermes/profiles/$hermes_profile"
  host_env_file="/opt/cortexos/.secrets/hermes/$hermes_profile.env"
  if [ ! -d "$host_profile_dir" ]; then log "WARNING: host profile dir not found: $host_profile_dir"; continue; fi
  if [ ! -f "$host_env_file" ]; then log "WARNING: host env file not found: $host_env_file"; continue; fi
  run_shell 'state=$(sudo -n incus list "'"$instance"'" --format csv -c s 2>/dev/null || true); [ "$state" = RUNNING ] || { echo "instance not running: '"$instance"'"; exit 1; }'
  # ollama (11435) is the direct LLM fallback path: Hermes fallback_providers
  # points at http://127.0.0.1:11435/v1 so a 9Router outage still has a local
  # model. The proxy device forwards the instance loopback to host ollama.
  for svc in 9router honcho ollama; do
    case "$svc" in 9router) port=11434 ;; honcho) port=18690 ;; ollama) port=11435 ;; esac
    run_shell 'sudo -n incus config device remove "'"$instance"'" proxy-"'"$svc"'" >/dev/null 2>&1 || true'
    run_shell 'sudo -n incus config device add "'"$instance"'" proxy-"'"$svc"'" proxy listen=tcp:127.0.0.1:"'"$port"'" connect=tcp:127.0.0.1:"'"$port"'" bind=instance'
  done
  run_shell 'sudo -n incus exec "'"$instance"'" -- bash -lc "mkdir -p /opt/cortexos/scripts /opt/cortexos/hermes/profiles/'"$hermes_profile"' /opt/cortexos/.secrets/hermes"'
  run_shell 'sudo -n incus file push -q /opt/cortexos/scripts/hermes-profile-api.mjs "'"$instance"'"/opt/cortexos/scripts/'
  run_shell 'sudo -n incus file push -r -q "'"$host_profile_dir"'" "'"$instance"'"/opt/cortexos/hermes/profiles/'
  run_shell 'sudo -n incus file push -q "'"$host_env_file"'" "'"$instance"'"/opt/cortexos/.secrets/hermes/'
  run_shell 'sudo -n incus exec "'"$instance"'" -- bash -lc "chown -R cortexos:cortexos /opt/cortexos/hermes/profiles/'"$hermes_profile"' /opt/cortexos/.secrets/hermes/'"$hermes_profile"'.env /opt/cortexos/scripts/hermes-profile-api.mjs; chmod 600 /opt/cortexos/.secrets/hermes/'"$hermes_profile"'.env"'
  svc_tmp="$(mktemp /tmp/hermes-profile-XXXXXX.service)"
  cat >"$svc_tmp" <<'SVC'
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
Environment=PATH=/home/cortexos/.local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/snap/bin
WorkingDirectory=/opt/cortexos/hermes/profiles/%i
ExecStart=/usr/bin/env node /opt/cortexos/scripts/hermes-profile-api.mjs %i
Restart=always
RestartSec=5
[Install]
WantedBy=multi-user.target
SVC
  run_shell 'sudo -n incus file push -q "'"$svc_tmp"'" "'"$instance"'"/etc/systemd/system/hermes-profile@'"$hermes_profile"'.service'
  rm -f "$svc_tmp"
  run_shell 'sudo -n incus exec "'"$instance"'" -- systemctl daemon-reload'
  run_shell 'sudo -n incus exec "'"$instance"'" -- systemctl enable hermes-profile@'"$hermes_profile"'.service'
  run_shell 'sudo -n incus exec "'"$instance"'" -- systemctl start hermes-profile@'"$hermes_profile"'.service'
  run_shell 'for i in $(seq 1 30); do state=$(sudo -n incus exec "'"$instance"'" -- systemctl is-active hermes-profile@'"$hermes_profile"'.service 2>/dev/null || true); [ "$state" = active ] && exit 0; sleep 2; done; echo "hermes-profile@'"$hermes_profile"' did not become active"; exit 1'
  api_port=$(grep HERMES_API_PORT "$host_env_file" | cut -d= -f2)
  run_shell 'sudo -n incus exec "'"$instance"'" -- bash -lc "curl -s -o /dev/null -w %{http_code} http://127.0.0.1:'"$api_port"'/health 2>/dev/null || curl -s -o /dev/null -w %{http_code} http://127.0.0.1:'"$api_port"'/ 2>/dev/null || true"'
  log "project $slug hermes profile moved and started"
  project_ok=$((project_ok + 1))
done <"$projects_manifest"
log "projects: $project_ok/$project_count hermes profiles moved"
if [ "$project_ok" -ne "$project_count" ]; then log "ERROR: not all hermes profiles validated"; exit 1; fi
for inst in mementry celebrar-me 3guns; do
  profile=""
  case "$inst" in mementry) profile=mementry ;; celebrar-me) profile=celebrar ;; 3guns) profile=3guns ;; esac
  run_shell 'sudo -n rm -rf /opt/cortexos/hermes/profiles/"'"$profile"'"'
  run_shell 'sudo -n rm -f /opt/cortexos/.secrets/hermes/"'"$profile"'".env'
done
log "host project hermes profiles removed"
log "completed $mode"
REMOTE
  if [ "$dry_run" -eq 1 ]; then mode="dry-run"; else mode="execute"; fi
  scp -q "$projects_manifest" "$CORTEX_HOST:/tmp/cortexos-projects.tsv"
  ssh_host "MODE=$mode BACKUP_DIR=$backup_dir_q PROJECTS_MANIFEST=/tmp/cortexos-projects.tsv bash -s" <"$remote_script"
  exit 0
fi


retired_manifest="$(require_manifest runtime-retired.tsv)"
protected_manifest="$(require_manifest runtime-protected.tsv)"

write_section "Protected Runtime"
print_tsv "$protected_manifest"

write_section "Retired Runtime"
print_tsv "$retired_manifest"

remote_script="$(mktemp)"
trap 'rm -f "$remote_script"' EXIT

cat >"$remote_script" <<'REMOTE'
set -Eeuo pipefail

mode="${MODE:?}"
backup_dir="${BACKUP_DIR:?}"
retired_manifest="${RETIRED_MANIFEST:?}"
protected_manifest="${PROTECTED_MANIFEST:?}"

log() {
  printf '[apply:%s] %s\n' "$mode" "$*"
}

run() {
  if [ "$mode" = "dry-run" ]; then
    printf '+'
    printf ' %q' "$@"
    printf '\n'
  else
    "$@"
  fi
}

run_shell() {
  local command="$1"
  if [ "$mode" = "dry-run" ]; then
    printf '+ bash -lc %q\n' "$command"
  else
    bash -lc "$command" </dev/null
  fi
}

protected_match() {
  local kind="$1"
  local name="$2"
  awk -F '\t' -v kind="$kind" -v name="$name" '
    $0 !~ /^#/ && $1 == kind && $2 == name { found = 1 }
    END { exit found ? 0 : 1 }
  ' "$protected_manifest"
}

test -d "$backup_dir"
test -s "$backup_dir/SHA256SUMS"
test -s "$backup_dir/archives/hermes.tgz"
test -s "$backup_dir/archives/secrets.tgz"

if sudo -n true 2>/dev/null; then
  sudo_cmd=(sudo -n)
else
  sudo_cmd=()
fi

while IFS=$'\t' read -r kind name action notes; do
  case "$kind" in
    ""|\#*) continue ;;
  esac

  if protected_match "$kind" "$name"; then
    log "skip protected $kind $name"
    continue
  fi

  case "$kind:$action" in
    systemd_unit:disable-stop-remove)
      if systemctl list-unit-files --no-legend "$name" 2>/dev/null | grep -q . || systemctl status "$name" >/dev/null 2>&1; then
        run "${sudo_cmd[@]}" systemctl disable --now "$name"
      else
        log "systemd unit not present: $name"
      fi
      if [ -e "/etc/systemd/system/$name" ]; then
        run "${sudo_cmd[@]}" rm -f "/etc/systemd/system/$name"
        run "${sudo_cmd[@]}" systemctl daemon-reload
      else
        log "systemd unit file not present: /etc/systemd/system/$name"
      fi
      if systemctl list-units --all --no-legend "$name" 2>/dev/null | grep -q .; then
        run "${sudo_cmd[@]}" systemctl reset-failed "$name"
      fi
      ;;
    docker_compose:down)
      compose_files="$(docker compose ls --format json 2>/dev/null | jq -r --arg name "$name" '.[] | select(.Name == $name) | .ConfigFiles' 2>/dev/null || true)"
      if [ -z "$compose_files" ]; then
        log "compose stack not present: $name"
      else
        IFS=',' read -r -a files <<<"$compose_files"
        args=(docker compose)
        for file in "${files[@]}"; do
          args+=(-f "$file")
        done
        args+=(down)
        run "${args[@]}"
      fi
      ;;
    package:audit-remove)
      if dpkg -s "$name" >/dev/null 2>&1; then
        audit_output="$("${sudo_cmd[@]}" dpkg --audit 2>&1 || true)"
        if [ -n "$audit_output" ]; then
          log "package database needs repair; deferred package removal: $name"
          printf '%s\n' "$audit_output" >&2
        else
          run "${sudo_cmd[@]}" apt-get remove -y "$name"
        fi
      else
        log "package not installed: $name"
      fi
      ;;
    local_bin:audit-remove)
      run "${sudo_cmd[@]}" rm -f "/usr/local/bin/$name"
      ;;
    secret:config-exported-remove)
      run "${sudo_cmd[@]}" rm -f "$name"
      ;;
    path:archive-remove)
      run "${sudo_cmd[@]}" rm -rf "$name"
      ;;
    *)
      log "no handler for $kind $name $action ($notes)"
      ;;
  esac
done <"$retired_manifest"

log "completed $mode"
REMOTE

if [ "$dry_run" -eq 1 ]; then
  mode="dry-run"
else
  mode="execute"
fi

scp -q "$retired_manifest" "$CORTEX_HOST:/tmp/cortexos-runtime-retired.tsv"
scp -q "$protected_manifest" "$CORTEX_HOST:/tmp/cortexos-runtime-protected.tsv"

ssh_host "MODE=$mode BACKUP_DIR=$backup_dir_q RETIRED_MANIFEST=/tmp/cortexos-runtime-retired.tsv PROTECTED_MANIFEST=/tmp/cortexos-runtime-protected.tsv bash -s" <"$remote_script"
