#!/usr/bin/env bash
# backup-openclaw-account.sh <account-slug>
# Quiesce → transactional export → manifest → age-encrypt → off-host copy.
# Generic: works for any OpenClaw account slug. Personal account wrappers live on the VPS only.
set -euo pipefail

case "${1:-}" in
  -h|--help)
    sed -n '2,4p' "$0" | sed 's/^# *//'
    echo
    echo "Usage: $0 <account-slug>"
    echo "Env: AGE_PUBKEY (required), BACKUP_ROOT, OFFHOST_DEST"
    exit 0
    ;;
esac

ACCOUNT_SLUG="${1:-}"
[[ -n "$ACCOUNT_SLUG" ]] || { echo "Usage: $0 <account-slug>"; exit 1; }

BACKUP_ROOT="${BACKUP_ROOT:-/opt/cortexos/backups/openclaw}"
OFFHOST_DEST="${OFFHOST_DEST:-}"  # e.g. user@backup-host:/backups/openclaw (rsync over Tailscale)
AGE_PUBKEY="${AGE_PUBKEY:-}"      # set in /opt/cortexos/.secrets/backup.env
LOCK_FILE="/var/lock/cortex-${ACCOUNT_SLUG}-backup.lock"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_DIR="${BACKUP_ROOT}/${ACCOUNT_SLUG}/${TS}"

log()  { printf '[backup:%s] %s\n' "$ACCOUNT_SLUG" "$*"; }
die()  { printf '[backup:%s] ERROR: %s\n' "$ACCOUNT_SLUG" "$*" >&2; exit 1; }

# Load secrets if not in env
[[ -f /opt/cortexos/.secrets/backup.env ]] && source /opt/cortexos/.secrets/backup.env

[[ -n "$AGE_PUBKEY" ]] || die "AGE_PUBKEY not set (export or set in /opt/cortexos/.secrets/backup.env)"

# ---------------------------------------------------------------------------
# Acquire exclusive lock
# ---------------------------------------------------------------------------
exec 200>"$LOCK_FILE"
flock -x -w 30 200 || die "could not acquire lock $LOCK_FILE within 30s"
log "lock acquired"

cleanup() {
  log "releasing lock"
  flock -u 200 2>/dev/null || true
  rm -f "$LOCK_FILE"
}
trap cleanup EXIT

# ---------------------------------------------------------------------------
# Quiesce — pause inbound polling for the account
# ---------------------------------------------------------------------------
log "pausing account $ACCOUNT_SLUG"
openclaw account pause "$ACCOUNT_SLUG" || die "failed to pause account"

# ---------------------------------------------------------------------------
# Export
# ---------------------------------------------------------------------------
mkdir -p "$BACKUP_DIR"
log "exporting to $BACKUP_DIR"

# Full openclaw.json snapshot
cp ~/.openclaw/openclaw.json "${BACKUP_DIR}/openclaw.json" \
  || die "openclaw.json copy failed"

# Per-account export (OpenViking + platform state)
openclaw account export "$ACCOUNT_SLUG" --output "${BACKUP_DIR}/account-export.json" \
  || die "openclaw account export failed"

# OpenViking memories for this account
if command -v openviking &>/dev/null; then
  openviking export --account "$ACCOUNT_SLUG" --output "${BACKUP_DIR}/openviking-export.json" \
    || log "WARNING: openviking export failed (non-fatal if not installed)"
fi

# ---------------------------------------------------------------------------
# Manifest — record counts + sha256
# ---------------------------------------------------------------------------
log "building manifest"
python3 - <<PYEOF > "${BACKUP_DIR}/manifest.json"
import json, hashlib, os, sys
files = {}
for fname in os.listdir("${BACKUP_DIR}"):
    fpath = os.path.join("${BACKUP_DIR}", fname)
    if fname == "manifest.json" or not os.path.isfile(fpath):
        continue
    with open(fpath, "rb") as f:
        data = f.read()
    files[fname] = {
        "sha256": hashlib.sha256(data).hexdigest(),
        "size": len(data)
    }
print(json.dumps({
    "account_slug": "${ACCOUNT_SLUG}",
    "ts": "${TS}",
    "files": files
}, indent=2))
PYEOF

# ---------------------------------------------------------------------------
# age-encrypt
# ---------------------------------------------------------------------------
log "encrypting backup"
ARCHIVE="${BACKUP_DIR}.tar"
ENCRYPTED="${ARCHIVE}.age"
tar -cf "$ARCHIVE" -C "$(dirname "$BACKUP_DIR")" "$(basename "$BACKUP_DIR")"
age -r "$AGE_PUBKEY" -o "$ENCRYPTED" "$ARCHIVE"
rm -f "$ARCHIVE"
rm -rf "$BACKUP_DIR"

# Permissions
chmod 600 "$ENCRYPTED"
log "encrypted backup: $ENCRYPTED"

# ---------------------------------------------------------------------------
# Off-host copy
# ---------------------------------------------------------------------------
if [[ -n "$OFFHOST_DEST" ]]; then
  log "copying to $OFFHOST_DEST"
  rsync -az --progress "$ENCRYPTED" "${OFFHOST_DEST}/${ACCOUNT_SLUG}/" \
    || log "WARNING: off-host rsync failed — backup is local only"
else
  log "OFFHOST_DEST not set — backup is local only"
fi

log "backup complete: $ENCRYPTED"
