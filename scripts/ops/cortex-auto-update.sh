#!/usr/bin/env bash
# CortexOS active updater with backup preflight and binary-change restarts.
set -euo pipefail

CORTEX_ROOT="${CORTEX_ROOT:-/opt/cortexos}"
BACKUP_ROOT="${BACKUP_ROOT:-/mnt/nas/Work/cortex-backups-512/daily}"
LOG_DIR="${LOG_DIR:-${CORTEX_ROOT}/logs}"
DRY_RUN=0
PARTIAL=0
STAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
LOG_FILE="${LOG_DIR}/auto-update-${STAMP}.log"
REPORT_FILE="${LOG_DIR}/auto-update-${STAMP}.json"
TMP_DIR="$(mktemp -d)"
SECTIONS=""
RESTARTS=""

usage() { printf 'Usage: cortex-auto-update.sh [--dry-run]\n'; }
while [ "$#" -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    -h|--help) usage; exit 0 ;;
    *) printf 'Unknown argument: %s\n' "$1" >&2; usage >&2; exit 2 ;;
  esac
  shift
done

mkdir -p "$LOG_DIR"
exec > >(tee -a "$LOG_FILE") 2>&1
trap 'rm -rf "$TMP_DIR"' EXIT

log() { printf '[%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
dry() { [ "$DRY_RUN" -eq 1 ]; }
have() { command -v "$1" >/dev/null 2>&1; }
run() { if dry; then printf '[dry-run]'; printf ' %q' "$@"; printf '\n'; else "$@"; fi; }
append_section() { SECTIONS="${SECTIONS}${SECTIONS:+ }$1:$2"; }
append_restart() { RESTARTS="${RESTARTS}${RESTARTS:+ }$1"; }
mark_fail() { PARTIAL=1; append_section "$1" fail; log "WARN: $1 failed"; }
mark_ok() { append_section "$1" ok; }

checksum_cmd() {
  name="$1"; out="$2"
  path="$(command -v "$name" 2>/dev/null || true)"
  if [ -n "$path" ] && [ -x "$path" ]; then sha256sum "$path" | awk '{print $1}' > "$out"; else : > "$out"; fi
}

snapshot_checksums() {
  suffix="$1"
  checksum_cmd 9router "${TMP_DIR}/9router.${suffix}"
  checksum_cmd node "${TMP_DIR}/node.${suffix}"
  checksum_cmd ollama "${TMP_DIR}/ollama.${suffix}"
  if [ -x /home/linuxbrew/.linuxbrew/bin/brew ]; then
    python3 - /home/linuxbrew/.linuxbrew/bin "${TMP_DIR}/brew.${suffix}" <<'PY'
import hashlib, os, sys
root, out = sys.argv[1:]
rows = []
for name in sorted(os.listdir(root)):
    path = os.path.join(root, name)
    if os.path.isfile(path) and os.access(path, os.X_OK):
        h = hashlib.sha256()
        with open(path, 'rb') as f:
            for chunk in iter(lambda: f.read(1024 * 1024), b''):
                h.update(chunk)
        rows.append(f"{h.hexdigest()}  {path}\n")
with open(out, 'w', encoding='utf-8') as f:
    f.writelines(rows)
PY
  else
    : > "${TMP_DIR}/brew.${suffix}"
  fi
}

changed() { ! cmp -s "${TMP_DIR}/$1.before" "${TMP_DIR}/$1.after"; }

restart_unit() {
  unit="$1"
  append_restart "$unit"
  run systemctl restart "$unit"
}

restart_if_loaded() {
  unit="$1"
  if dry; then restart_unit "$unit"; return; fi
  if systemctl list-unit-files "$unit" --no-legend 2>/dev/null | grep -q . || systemctl status "$unit" >/dev/null 2>&1; then
    restart_unit "$unit"
  else
    log "Skip missing unit: $unit"
  fi
}

restart_pattern() {
  pattern="$1"
  if dry; then append_restart "$pattern"; log "[dry-run] systemctl restart $pattern"; return; fi
  mapfile -t units < <(systemctl list-units "$pattern" --state=running --no-legend --plain | awk '{print $1}')
  if [ "${#units[@]}" -eq 0 ]; then log "No running units for $pattern"; return; fi
  for unit in "${units[@]}"; do restart_unit "$unit"; done
}

preflight() {
  if dry; then log "[dry-run] preflight: require encrypted backup <24h in $BACKUP_ROOT"; return; fi
  newest="$(python3 - "$BACKUP_ROOT" <<'PY'
import glob, os, sys
files = glob.glob(os.path.join(sys.argv[1], '*.tar.gz.age'))
print(max(files, key=os.path.getmtime) if files else '')
PY
)"
  if [ -z "$newest" ]; then log "no encrypted backup found in $BACKUP_ROOT"; exit 2; fi
  if ! python3 - "$newest" <<'PY'
import os, sys, time
sys.exit(0 if time.time() - os.path.getmtime(sys.argv[1]) < 86400 else 1)
PY
  then log "latest backup is older than 24h: $newest"; exit 2; fi
}

section() {
  name="$1"; shift
  log "== $name =="
  if "$@"; then mark_ok "$name"; else mark_fail "$name"; fi
}

update_apt() {
  have apt-get || return 0
  run apt-get update
  DEBIAN_FRONTEND=noninteractive run apt-get upgrade -y
}

update_brew() {
  [ -x /home/linuxbrew/.linuxbrew/bin/brew ] || return 0
  # shellcheck disable=SC1091
  eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"
  run brew update
  run brew upgrade
}

update_npm_global() {
  have npm || return 0
  run npm update -g
}

update_pip_venvs() {
  found=0
  for pip in "${CORTEX_ROOT}"/stacks/*/.venv/bin/pip; do
    [ -x "$pip" ] || continue
    found=1
    run "$pip" install --upgrade pip setuptools wheel
    freeze="$($pip freeze --local | python3 -c 'import sys; print(" ".join(line.split("==", 1)[0].strip() for line in sys.stdin if line.strip()))' || true)"
    [ -n "$freeze" ] || continue
    if dry; then log "[dry-run] $pip install --upgrade <venv packages>"; else "$pip" install --upgrade $freeze; fi
  done
  [ "$found" -eq 1 ] || log "No pip venvs found"
}

update_snap() {
  have snap || return 0
  run snap refresh
}

update_docker_compose() {
  have docker || return 0
  for compose in "${CORTEX_ROOT}"/stacks/*/docker-compose.yml; do
    [ -f "$compose" ] || continue
    dir="$(dirname "$compose")"
    run docker compose -f "$compose" pull
    run docker compose -f "$compose" up -d --remove-orphans
    log "Updated compose stack: $dir"
  done
}

smart_restarts() {
  changed 9router && { restart_if_loaded 9router.service || true; restart_if_loaded 9router-docker-proxy.service || true; }
  changed node && { restart_if_loaded cortex-dashboard.service || true; restart_pattern 'hermes-profile@*.service' || true; }
  changed ollama && { restart_if_loaded ollama.service || true; restart_if_loaded ollama-honcho-embeddings-proxy.service || true; }
  if changed brew; then
    restart_if_loaded 9router.service || true
    restart_if_loaded cortex-dashboard.service || true
  fi
}

write_report() {
  python3 - "$REPORT_FILE" "$PARTIAL" "$SECTIONS" "$RESTARTS" "$LOG_FILE" <<'PY'
import json, sys, time
path, partial, sections, restarts, log_file = sys.argv[1:]
def pairs(s):
    out = []
    for item in filter(None, s.split(' ')):
        if ':' in item:
            name, status = item.rsplit(':', 1)
            out.append({"name": name, "status": status})
    return out
with open(path, 'w', encoding='utf-8') as f:
    json.dump({
        "created_at": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        "partial_failure": partial == '1',
        "sections": pairs(sections),
        "restarts": [x for x in restarts.split(' ') if x],
        "log_file": log_file,
    }, f, indent=2)
    f.write('\n')
PY
}

preflight
snapshot_checksums before
section apt update_apt
section brew update_brew
section npm update_npm_global
section pip update_pip_venvs
section snap update_snap
section docker update_docker_compose
snapshot_checksums after
section restarts smart_restarts
write_report
log "Report: $REPORT_FILE"
[ "$PARTIAL" -eq 0 ] || exit 1
