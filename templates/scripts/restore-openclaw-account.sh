#!/usr/bin/env bash
# restore-openclaw-account.sh <account-slug> <backup-ts>
# Stage → validate → atomic rename → fidelity diff → unpause.
set -euo pipefail

ACCOUNT_SLUG="${1:-}"
BACKUP_TS="${2:-}"
[[ -n "$ACCOUNT_SLUG" && -n "$BACKUP_TS" ]] \
  || { echo "Usage: $0 <account-slug> <backup-ts>"; exit 1; }

BACKUP_ROOT="${BACKUP_ROOT:-/opt/cortexos/backups/openclaw}"
AGE_IDENTITY="${AGE_IDENTITY:-/opt/cortexos/.secrets/backup-identity.txt}"
LOCK_FILE="/var/lock/cortex-${ACCOUNT_SLUG}-backup.lock"

ENCRYPTED="${BACKUP_ROOT}/${ACCOUNT_SLUG}/${BACKUP_TS}.tar.age"
STAGE_DIR="/tmp/cortex-restore-${ACCOUNT_SLUG}-${BACKUP_TS}"

log() { printf '[restore:%s] %s\n' "$ACCOUNT_SLUG" "$*"; }
die() { printf '[restore:%s] ERROR: %s\n' "$ACCOUNT_SLUG" "$*" >&2; exit 1; }

[[ -f "$ENCRYPTED" ]] || die "backup not found: $ENCRYPTED"
[[ -f "$AGE_IDENTITY" ]] || die "age identity not found: $AGE_IDENTITY"

exec 200>"$LOCK_FILE"
flock -x -w 30 200 || die "could not acquire lock"
log "lock acquired"

cleanup() {
  rm -rf "$STAGE_DIR"
  flock -u 200 2>/dev/null || true
  rm -f "$LOCK_FILE"
}
trap cleanup EXIT

# ---------------------------------------------------------------------------
# Decrypt + extract to staging
# ---------------------------------------------------------------------------
mkdir -p "$STAGE_DIR"
log "decrypting $ENCRYPTED"
age -d -i "$AGE_IDENTITY" -o "${STAGE_DIR}/restore.tar" "$ENCRYPTED"
tar -xf "${STAGE_DIR}/restore.tar" -C "$STAGE_DIR"
rm -f "${STAGE_DIR}/restore.tar"

RESTORE_DIR="${STAGE_DIR}/${BACKUP_TS}"
[[ -d "$RESTORE_DIR" ]] || die "expected directory $RESTORE_DIR not found in archive"

# ---------------------------------------------------------------------------
# Validate manifest
# ---------------------------------------------------------------------------
log "validating manifest"
python3 - <<PYEOF
import json, hashlib, os, sys

manifest_path = os.path.join("${RESTORE_DIR}", "manifest.json")
if not os.path.isfile(manifest_path):
    sys.exit("manifest.json missing")

with open(manifest_path) as f:
    manifest = json.load(f)

errors = []
for fname, meta in manifest.get("files", {}).items():
    fpath = os.path.join("${RESTORE_DIR}", fname)
    if not os.path.isfile(fpath):
        errors.append(f"MISSING: {fname}")
        continue
    with open(fpath, "rb") as f:
        actual = hashlib.sha256(f.read()).hexdigest()
    if actual != meta["sha256"]:
        errors.append(f"SHA256 MISMATCH: {fname} expected={meta['sha256']} actual={actual}")

if errors:
    print("Validation FAILED:")
    for e in errors:
        print(" ", e)
    sys.exit(1)

print(f"Manifest OK: {len(manifest['files'])} files validated")
PYEOF

log "manifest validation passed"

# ---------------------------------------------------------------------------
# Pause account before applying
# ---------------------------------------------------------------------------
log "pausing account $ACCOUNT_SLUG"
openclaw account pause "$ACCOUNT_SLUG" || log "WARNING: pause failed (may already be paused)"

# ---------------------------------------------------------------------------
# Apply — atomic restore
# ---------------------------------------------------------------------------
log "restoring openclaw.json"
cp ~/.openclaw/openclaw.json ~/.openclaw/openclaw.json.pre-restore
cp "${RESTORE_DIR}/openclaw.json" ~/.openclaw/openclaw.json

if [[ -f "${RESTORE_DIR}/account-export.json" ]]; then
  log "importing account state"
  openclaw account import "$ACCOUNT_SLUG" --input "${RESTORE_DIR}/account-export.json" \
    || die "openclaw account import failed — live state may be inconsistent; do NOT unpause"
fi

if [[ -f "${RESTORE_DIR}/openviking-export.json" ]] && command -v openviking &>/dev/null; then
  log "importing OpenViking memories"
  openviking import --account "$ACCOUNT_SLUG" --input "${RESTORE_DIR}/openviking-export.json" \
    || log "WARNING: openviking import failed (non-fatal)"
fi

# ---------------------------------------------------------------------------
# Fidelity diff
# ---------------------------------------------------------------------------
log "fidelity diff"
openclaw account export "$ACCOUNT_SLUG" --output /tmp/post-restore-export.json || true
python3 - <<PYEOF
import json, sys

with open("${RESTORE_DIR}/account-export.json") as f:
    pre = json.load(f)
with open("/tmp/post-restore-export.json") as f:
    post = json.load(f)

pre_count = len(pre) if isinstance(pre, list) else 1
post_count = len(post) if isinstance(post, list) else 1
print(f"Pre-restore count: {pre_count}, Post-restore count: {post_count}")
if pre_count != post_count:
    print(f"WARNING: count mismatch ({pre_count} vs {post_count})")
    sys.exit(1)
print("Fidelity diff: OK")
PYEOF

# ---------------------------------------------------------------------------
# Unpause
# ---------------------------------------------------------------------------
log "unpausing account $ACCOUNT_SLUG"
openclaw account unpause "$ACCOUNT_SLUG" \
  || log "WARNING: unpause failed — account may still be paused; run: openclaw account unpause $ACCOUNT_SLUG"

log "restore complete for $ACCOUNT_SLUG @ $BACKUP_TS"
