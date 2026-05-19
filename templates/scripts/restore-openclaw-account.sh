#!/usr/bin/env bash
# restore-openclaw-account.sh <account-slug> <backup-archive>
# Restore the on-disk OpenClaw snapshot produced by backup-openclaw-account.sh.
set -euo pipefail

ACCOUNT_SLUG="${1:-}"
ARCHIVE_PATH="${2:-}"
[[ -n "$ACCOUNT_SLUG" && -n "$ARCHIVE_PATH" ]] || {
  echo "Usage: $0 <account-slug> <backup-archive>" >&2
  exit 1
}

BACKUP_ROOT="${BACKUP_ROOT:-/opt/cortexos/.secrets/backups}"
AGE_IDENTITY="${AGE_IDENTITY:-/opt/cortexos/.secrets/backup-identity.txt}"
LOCK_FILE="/var/lock/cortex-${ACCOUNT_SLUG}-backup.lock"
STAGE_DIR="$(mktemp -d /tmp/cortex-restore-${ACCOUNT_SLUG}-XXXXXX)"
OPENCLAW_HOME="${OPENCLAW_HOME:-$HOME/.openclaw}"

log() { printf '[restore:%s] %s\n' "$ACCOUNT_SLUG" "$*"; }
die() { printf '[restore:%s] ERROR: %s\n' "$ACCOUNT_SLUG" "$*" >&2; exit 1; }

[[ -f "$ARCHIVE_PATH" ]] || die "backup not found: $ARCHIVE_PATH"

exec 200>"$LOCK_FILE"
flock -x -w 30 200 || die "could not acquire lock"
cleanup() {
  rm -rf "$STAGE_DIR"
  flock -u 200 2>/dev/null || true
  rm -f "$LOCK_FILE"
}
trap cleanup EXIT

EXTRACT_ARCHIVE="$ARCHIVE_PATH"
if [[ "$ARCHIVE_PATH" == *.age ]]; then
  [[ -f "$AGE_IDENTITY" ]] || die "age identity not found: $AGE_IDENTITY"
  log "decrypting $ARCHIVE_PATH"
  EXTRACT_ARCHIVE="${STAGE_DIR}/restore.tar.gz"
  age -d -i "$AGE_IDENTITY" -o "$EXTRACT_ARCHIVE" "$ARCHIVE_PATH"
fi

log "extracting archive"
tar -xzf "$EXTRACT_ARCHIVE" -C "$STAGE_DIR"
RESTORE_DIR="${STAGE_DIR}/${ACCOUNT_SLUG}"
[[ -d "$RESTORE_DIR" ]] || die "expected directory $RESTORE_DIR not found in archive"

log "validating manifest"
python3 - <<PYEOF
import hashlib, json, os, sys
root = os.path.abspath("${RESTORE_DIR}")
manifest_path = os.path.join(root, "manifest.json")
if not os.path.isfile(manifest_path):
    sys.exit("manifest.json missing")
manifest = json.load(open(manifest_path))
errors = []
for rel, meta in manifest.get("files", {}).items():
    path = os.path.join(root, rel)
    if not os.path.isfile(path):
        errors.append(f"missing: {rel}")
        continue
    data = open(path, "rb").read()
    actual = hashlib.sha256(data).hexdigest()
    if actual != meta["sha256"]:
        errors.append(f"sha256 mismatch: {rel}")
if errors:
    print("Validation FAILED")
    for err in errors:
        print(err)
    sys.exit(1)
print(f"Manifest OK: {len(manifest['files'])} files validated")
PYEOF

CONFIG_DEST="${OPENCLAW_HOME}/openclaw.json"
WORKSPACE_DEST="${OPENCLAW_HOME}/workspace"
AGENTS_ROOT="${OPENCLAW_HOME}/agents"
mkdir -p "$OPENCLAW_HOME" "$AGENTS_ROOT"

if systemctl list-unit-files openclaw-gateway.service >/dev/null 2>&1; then
  log "stopping openclaw-gateway"
  sudo systemctl stop openclaw-gateway || true
fi

log "restoring config"
cp -a "$RESTORE_DIR/openclaw.json" "$CONFIG_DEST"

if [[ -d "$RESTORE_DIR/workspace" ]]; then
  rm -rf "$WORKSPACE_DEST"
  cp -a "$RESTORE_DIR/workspace" "$WORKSPACE_DEST"
fi

if [[ -d "$RESTORE_DIR/agent" ]]; then
  target_agent_dir="${AGENTS_ROOT}/${ACCOUNT_SLUG}"
  rm -rf "$target_agent_dir"
  cp -a "$RESTORE_DIR/agent" "$target_agent_dir"
fi

if systemctl list-unit-files openclaw-gateway.service >/dev/null 2>&1; then
  log "starting openclaw-gateway"
  sudo systemctl start openclaw-gateway
fi

log "restore complete"
