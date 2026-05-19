#!/usr/bin/env bash
# backup-openclaw-account.sh <account-slug> [--dry-run]
# Snapshot the current OpenClaw operator state for one account/agent slug.
# Current OpenClaw releases no longer expose `openclaw account export`, so the
# backup unit is the on-disk state: config, matching agent directory, workspace,
# and a manifest with sha256s for restore validation.
set -euo pipefail

case "${1:-}" in
  -h|--help)
    sed -n '2,5p' "$0" | sed 's/^# *//'
    echo
    echo "Usage: $0 <account-slug> [--dry-run]"
    echo "Env: BACKUP_ROOT, AGE_PUBKEY, OFFHOST_DEST"
    exit 0
    ;;
esac

ACCOUNT_SLUG="${1:-}"
MODE="${2:-}"
[[ -n "$ACCOUNT_SLUG" ]] || { echo "Usage: $0 <account-slug> [--dry-run]"; exit 1; }
[[ "$MODE" == "" || "$MODE" == "--dry-run" ]] || { echo "unknown arg: $MODE" >&2; exit 1; }
DRY_RUN=0
[[ "$MODE" == "--dry-run" ]] && DRY_RUN=1

BACKUP_ROOT="${BACKUP_ROOT:-/opt/cortexos/.secrets/backups}"
OFFHOST_DEST="${OFFHOST_DEST:-}"
AGE_PUBKEY="${AGE_PUBKEY:-}"
LOCK_FILE="/var/lock/cortex-${ACCOUNT_SLUG}-backup.lock"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
STAGE_DIR="${BACKUP_ROOT}/.${ACCOUNT_SLUG}-${TS}.stage"
ARCHIVE_BASENAME="openclaw-${ACCOUNT_SLUG}-${TS}.tar.gz"
ARCHIVE_PATH="${BACKUP_ROOT}/${ARCHIVE_BASENAME}"

log() { printf '[backup:%s] %s\n' "$ACCOUNT_SLUG" "$*"; }
die() { printf '[backup:%s] ERROR: %s\n' "$ACCOUNT_SLUG" "$*" >&2; exit 1; }

[[ -f /opt/cortexos/.secrets/backup.env ]] && source /opt/cortexos/.secrets/backup.env

OPENCLAW_HOME="${OPENCLAW_HOME:-$HOME/.openclaw}"
CONFIG_PATH="${OPENCLAW_HOME}/openclaw.json"
WORKSPACE_DIR="${OPENCLAW_HOME}/workspace"
AGENT_DIR_CANDIDATES=(
  "${OPENCLAW_HOME}/agents/${ACCOUNT_SLUG}"
  "${OPENCLAW_HOME}/agents/main"
)

[[ -f "$CONFIG_PATH" ]] || die "missing OpenClaw config: $CONFIG_PATH"
[[ -d "$WORKSPACE_DIR" ]] || die "missing workspace dir: $WORKSPACE_DIR"

AGENT_DIR=""
for candidate in "${AGENT_DIR_CANDIDATES[@]}"; do
  if [[ -d "$candidate" ]]; then
    AGENT_DIR="$candidate"
    break
  fi
done
[[ -n "$AGENT_DIR" ]] || die "no agent directory found for ${ACCOUNT_SLUG} (checked ${AGENT_DIR_CANDIDATES[*]})"

exec 200>"$LOCK_FILE"
flock -x -w 30 200 || die "could not acquire lock $LOCK_FILE within 30s"
cleanup() {
  flock -u 200 2>/dev/null || true
  rm -f "$LOCK_FILE"
  rm -rf "$STAGE_DIR"
}
trap cleanup EXIT

mkdir -p "$BACKUP_ROOT"
mkdir -p "$STAGE_DIR"
SNAPSHOT_DIR="${STAGE_DIR}/${ACCOUNT_SLUG}"
mkdir -p "$SNAPSHOT_DIR"

copy_list=(
  "$CONFIG_PATH|openclaw.json"
  "$WORKSPACE_DIR|workspace"
  "$AGENT_DIR|agent"
)

log "account slug: $ACCOUNT_SLUG"
log "agent dir: $AGENT_DIR"
log "workspace: $WORKSPACE_DIR"
log "backup root: $BACKUP_ROOT"

if (( DRY_RUN )); then
  printf 'DRY-RUN\n'
  for item in "${copy_list[@]}"; do
    src="${item%%|*}"
    dst="${item##*|}"
    printf '  %s -> %s\n' "$src" "$dst"
  done
  exit 0
fi

for item in "${copy_list[@]}"; do
  src="${item%%|*}"
  dst="${item##*|}"
  cp -a "$src" "${SNAPSHOT_DIR}/${dst}"
done

python3 - <<PYEOF > "${SNAPSHOT_DIR}/manifest.json"
import hashlib, json, os
root = os.path.abspath("${SNAPSHOT_DIR}")
files = {}
for dirpath, _, filenames in os.walk(root):
    for name in sorted(filenames):
        path = os.path.join(dirpath, name)
        rel = os.path.relpath(path, root)
        with open(path, "rb") as f:
            data = f.read()
        files[rel] = {
            "sha256": hashlib.sha256(data).hexdigest(),
            "size": len(data),
        }
print(json.dumps({
    "account_slug": "${ACCOUNT_SLUG}",
    "ts": "${TS}",
    "agent_dir": "${AGENT_DIR}",
    "files": files,
}, indent=2))
PYEOF

tar -czf "$ARCHIVE_PATH" -C "$STAGE_DIR" "$ACCOUNT_SLUG"
chmod 600 "$ARCHIVE_PATH"
log "backup archive written: $ARCHIVE_PATH"

if [[ -n "$AGE_PUBKEY" ]]; then
  age -r "$AGE_PUBKEY" -o "${ARCHIVE_PATH}.age" "$ARCHIVE_PATH"
  chmod 600 "${ARCHIVE_PATH}.age"
  log "encrypted backup written: ${ARCHIVE_PATH}.age"
else
  log "AGE_PUBKEY not set — leaving backup unencrypted"
fi

if [[ -n "$OFFHOST_DEST" ]]; then
  log "copying backup to $OFFHOST_DEST"
  scp -q "${ARCHIVE_PATH}.age" "$OFFHOST_DEST" 2>/dev/null \
    || scp -q "$ARCHIVE_PATH" "$OFFHOST_DEST" \
    || log "WARNING: off-host copy failed"
fi

log "backup complete"
