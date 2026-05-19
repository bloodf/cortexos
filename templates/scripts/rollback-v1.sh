#!/usr/bin/env bash
# rollback-v1.sh [--dry-run]
# Restore pg_dump + OpenClaw config + pinned dashboard redeploy + systemd unit restore.
set -euo pipefail

case "${1:-}" in
  -h|--help)
    cat <<'USAGE'
Usage: rollback-v1.sh [--dry-run]

Restores the most recent age-encrypted pg_dump from $BACKUP_ROOT, replays
OpenClaw config, redeploys the pinned dashboard build, and restores systemd
units. --dry-run prints actions without changing anything.

Env: BACKUP_ROOT (default /opt/cortexos/backups),
     AGE_IDENTITY (default /opt/cortexos/.secrets/backup-identity.txt),
     POSTGRES_DB, POSTGRES_USER, DASHBOARD_DIR, STACKS_DIR.
USAGE
    exit 0
    ;;
esac

DRY_RUN=0
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=1

BACKUP_ROOT="${BACKUP_ROOT:-/opt/cortexos/backups}"
DASHBOARD_DIR="${DASHBOARD_DIR:-/opt/cortexos/packages/cortex-dashboard}"
STACKS_DIR="${STACKS_DIR:-/opt/cortexos/stacks}"
SYSTEMD_BACKUP="${BACKUP_ROOT}/systemd"
DB_BACKUP_DIR="${BACKUP_ROOT}/dashboard"
DB_BACKUP_NAME_GLOB="pre-v1-rebuild-*.sql.age"
AGE_IDENTITY="${AGE_IDENTITY:-/opt/cortexos/.secrets/backup-identity.txt}"

log()    { printf '[rollback] %s\n' "$*"; }
die()    { printf '[rollback] ERROR: %s\n' "$*" >&2; exit 1; }
dryrun() { if [[ "$DRY_RUN" -eq 1 ]]; then log "[DRY-RUN] $*"; return 0; fi; "$@"; }

[[ "$DRY_RUN" -eq 1 ]] && log "DRY-RUN MODE — no changes will be applied"

# ---------------------------------------------------------------------------
# Find most recent pg_dump backup (find handles missing dir + empty result
# safely under set -euo pipefail; the old `ls $glob` pattern aborted silently)
# ---------------------------------------------------------------------------
DB_BACKUP=""
if [[ -d "$DB_BACKUP_DIR" ]]; then
  DB_BACKUP="$(find "$DB_BACKUP_DIR" -maxdepth 1 -type f -name "$DB_BACKUP_NAME_GLOB" -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -n1 | cut -d' ' -f2- || true)"
fi
[[ -n "$DB_BACKUP" ]] || die "no pg_dump backup found matching $DB_BACKUP_DIR/$DB_BACKUP_NAME_GLOB"
log "pg_dump backup: $DB_BACKUP"

# ---------------------------------------------------------------------------
# 1. Stop dashboard
# ---------------------------------------------------------------------------
log "stopping dashboard service"
dryrun systemctl stop cortex-dashboard || log "WARNING: dashboard may not be running"

# ---------------------------------------------------------------------------
# 2. Restore database
# ---------------------------------------------------------------------------
log "restoring database from $DB_BACKUP"
if [[ "$DRY_RUN" -eq 0 ]]; then
  [[ -f "$AGE_IDENTITY" ]] || die "AGE_IDENTITY not found: $AGE_IDENTITY"
  age -d -i "$AGE_IDENTITY" -o /tmp/rollback-db.sql "$DB_BACKUP"
  DB_NAME="${POSTGRES_DB:-cortexos}"
  DB_USER="${POSTGRES_USER:-cortex}"
  psql -U "$DB_USER" -c "DROP DATABASE IF EXISTS ${DB_NAME}_rollback_stage;"
  psql -U "$DB_USER" -c "CREATE DATABASE ${DB_NAME}_rollback_stage;"
  psql -U "$DB_USER" -d "${DB_NAME}_rollback_stage" < /tmp/rollback-db.sql
  psql -U "$DB_USER" -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${DB_NAME}';"
  psql -U "$DB_USER" -c "DROP DATABASE IF EXISTS ${DB_NAME};"
  psql -U "$DB_USER" -c "ALTER DATABASE ${DB_NAME}_rollback_stage RENAME TO ${DB_NAME};"
  rm -f /tmp/rollback-db.sql
  log "database restored"
else
  log "[DRY-RUN] would decrypt $DB_BACKUP and restore to ${POSTGRES_DB:-cortexos}"
fi

# ---------------------------------------------------------------------------
# 3. Restore OpenClaw config
# ---------------------------------------------------------------------------
OPENCLAW_BACKUP="${BACKUP_ROOT}/openclaw-json/openclaw.pre-v1.json"
if [[ -f "$OPENCLAW_BACKUP" ]]; then
  log "restoring openclaw.json"
  dryrun cp ~/.openclaw/openclaw.json ~/.openclaw/openclaw.json.post-v1-attempt
  dryrun cp "$OPENCLAW_BACKUP" ~/.openclaw/openclaw.json
else
  log "WARNING: openclaw.json backup not found at $OPENCLAW_BACKUP — skipping"
fi

# ---------------------------------------------------------------------------
# 4. Restore systemd units
# ---------------------------------------------------------------------------
if [[ -d "$SYSTEMD_BACKUP" ]]; then
  log "restoring systemd units from $SYSTEMD_BACKUP"
  dryrun cp -r "${SYSTEMD_BACKUP}/." /etc/systemd/system/
  dryrun systemctl daemon-reload
else
  log "WARNING: systemd backup dir not found — skipping unit restore"
fi

# ---------------------------------------------------------------------------
# 5. Redeploy pinned dashboard build
# ---------------------------------------------------------------------------
DASHBOARD_ARCHIVE="${BACKUP_ROOT}/dashboard/pre-v1-dashboard-build.tar.gz"
if [[ -f "$DASHBOARD_ARCHIVE" ]]; then
  log "redeploying pinned dashboard build"
  dryrun tar -xzf "$DASHBOARD_ARCHIVE" -C "$(dirname "$DASHBOARD_DIR")"
else
  log "WARNING: pinned dashboard build archive not found — skipping redeploy"
fi

# ---------------------------------------------------------------------------
# 6. Restart services
# ---------------------------------------------------------------------------
log "restarting services"
dryrun systemctl start cortex-dashboard
dryrun systemctl restart cortex-consumer || log "WARNING: consumer restart failed"

# ---------------------------------------------------------------------------
# 7. Verify
# ---------------------------------------------------------------------------
log "waiting 10s for services to stabilise"
[[ "$DRY_RUN" -eq 0 ]] && sleep 10

log "health check"
if [[ "$DRY_RUN" -eq 0 ]]; then
  curl -sf http://localhost:7080/healthz | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['status'])" \
    || log "WARNING: consumer health check failed"
  curl -sf http://localhost:3080/api/healthcheck \
    || log "WARNING: dashboard health check failed"
fi

log "rollback complete (dry_run=$DRY_RUN)"
