#!/usr/bin/env bash
# Full CortexOS backup: logical DB dumps + service/config files, age-encrypted.
set -euo pipefail

CORTEX_ROOT="${CORTEX_ROOT:-/opt/cortexos}"
BACKUP_ROOT="${BACKUP_ROOT:-/mnt/hdd/backups}"
SECRETS_DIR="${SECRETS_DIR:-${CORTEX_ROOT}/.secrets}"
BACKUP_ENV="${BACKUP_ENV:-${SECRETS_DIR}/backup.env}"
AGE_IDENTITY="${AGE_IDENTITY:-${SECRETS_DIR}/backup-identity.txt}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
MAX_SNAPSHOTS="${MAX_SNAPSHOTS:-14}"
LOG_DIR="${LOG_DIR:-${CORTEX_ROOT}/logs}"
DRY_RUN=0
PRUNE_ONLY=0

usage() {
  cat <<'EOF'
Usage: cortex-backup.sh [--dry-run] [--prune-only]

Creates /mnt/hdd/backups/YYYY-MM-DD_HHMM.tar.gz.age and prunes backups older
than 7 days / beyond 14 snapshots. --dry-run prints actions only.
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    --prune-only) PRUNE_ONLY=1 ;;
    -h|--help) usage; exit 0 ;;
    *) printf 'Unknown argument: %s\n' "$1" >&2; usage >&2; exit 2 ;;
  esac
  shift
done

STAMP="$(date -u +%Y-%m-%d_%H%M)"
LOG_STAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
LOG_FILE="${LOG_DIR}/backup-${LOG_STAMP}.log"
WORK_DIR="${BACKUP_ROOT}/${STAMP}"
ARCHIVE="${BACKUP_ROOT}/${STAMP}.tar.gz"
ENCRYPTED="${ARCHIVE}.age"
MANIFEST="${WORK_DIR}/manifest.json"
PARTIAL=0

mkdir -p "$LOG_DIR"
exec > >(tee -a "$LOG_FILE") 2>&1

log() { printf '[%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
dry() { [ "$DRY_RUN" -eq 1 ]; }
run() { if dry; then printf '[dry-run]'; printf ' %q' "$@"; printf '\n'; else "$@"; fi; }
warn() { PARTIAL=1; log "WARN: $*"; }
have() { command -v "$1" >/dev/null 2>&1; }
container_running() { docker inspect -f '{{.State.Running}}' "$1" 2>/dev/null | grep -qx true; }

copy_path() {
  src="$1"; dst="$2"
  if [ -e "$src" ]; then
    run mkdir -p "$(dirname "$dst")"
    run cp -a "$src" "$dst"
  else
    warn "missing path: $src"
  fi
}

copy_glob() {
  dst="$1"; shift
  run mkdir -p "$dst"
  for pattern in "$@"; do
    found=0
    for src in $pattern; do
      [ -e "$src" ] || continue
      found=1
      run cp -a "$src" "$dst/"
    done
    [ "$found" -eq 1 ] || warn "no matches: $pattern"
  done
}

dump_container() {
  name="$1"; outfile="$2"; shift 2
  if ! have docker; then warn "docker unavailable for $name"; return; fi
  if ! container_running "$name"; then warn "container not running: $name"; return; fi
  run mkdir -p "$(dirname "$outfile")"
  if dry; then printf '[dry-run] docker exec %q ... > %q\n' "$name" "$outfile"; return; fi
  if ! docker exec "$name" "$@" | gzip -c > "$outfile"; then warn "dump failed: $name"; rm -f "$outfile"; fi
}

copy_from_container() {
  name="$1"; src="$2"; dst="$3"
  if ! have docker; then warn "docker unavailable for $name"; return; fi
  if ! container_running "$name"; then warn "container not running: $name"; return; fi
  run mkdir -p "$(dirname "$dst")"
  run docker cp "${name}:${src}" "$dst"
}

backup_redis() {
  name="$1"; outfile="$2"
  if ! have docker; then warn "docker unavailable for $name"; return; fi
  if ! container_running "$name"; then warn "container not running: $name"; return; fi
  if dry; then
    log "[dry-run] docker exec $name redis-cli BGSAVE; docker cp ${name}:/data/dump.rdb $outfile"
    return
  fi
  docker exec "$name" redis-cli BGSAVE >/dev/null || warn "redis BGSAVE failed: $name"
  sleep 2
  copy_from_container "$name" /data/dump.rdb "$outfile"
}

write_manifest() {
  if dry; then log "[dry-run] write manifest $MANIFEST"; return; fi
  python3 - "$WORK_DIR" "$MANIFEST" <<'PY'
import hashlib, json, os, sys, time
root, manifest = sys.argv[1:3]
files = []
for base, _, names in os.walk(root):
    for name in names:
        path = os.path.join(base, name)
        if path == manifest:
            continue
        h = hashlib.sha256()
        with open(path, 'rb') as f:
            for chunk in iter(lambda: f.read(1024 * 1024), b''):
                h.update(chunk)
        files.append({"path": os.path.relpath(path, root), "bytes": os.path.getsize(path), "sha256": h.hexdigest()})
files.sort(key=lambda x: x["path"])
with open(manifest, 'w', encoding='utf-8') as f:
    json.dump({"created_at": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), "files": files}, f, indent=2)
    f.write('\n')
PY
}

prune_backups() {
  run mkdir -p "$BACKUP_ROOT"
  log "Pruning backups in $BACKUP_ROOT older than ${RETENTION_DAYS}d, keeping newest ${MAX_SNAPSHOTS} encrypted snapshots"
  if dry; then
    log "[dry-run] prune ${BACKUP_ROOT}/*.tar.gz.age and legacy timestamp dirs/tars"
    return
  fi
  python3 - "$BACKUP_ROOT" "$RETENTION_DAYS" "$MAX_SNAPSHOTS" <<'PY'
import glob, os, shutil, sys, time
root, days, max_keep = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
cutoff = time.time() - days * 86400
for path in glob.glob(os.path.join(root, '*')):
    name = os.path.basename(path)
    if not (name.endswith('.tar.gz.age') or name.endswith('.tar.gz') or (os.path.isdir(path) and len(name) >= 12 and name[4:5] == '-' and '_' in name)):
        continue
    if os.path.getmtime(path) < cutoff:
        shutil.rmtree(path) if os.path.isdir(path) else os.remove(path)
snapshots = sorted(glob.glob(os.path.join(root, '*.tar.gz.age')), key=os.path.getmtime, reverse=True)
for path in snapshots[max_keep:]:
    os.remove(path)
PY
}

preflight() {
  if ! dry && ! mountpoint -q /mnt/hdd; then log "/mnt/hdd is not mounted"; exit 2; fi
  if [ -r "$BACKUP_ENV" ]; then
    # shellcheck disable=SC1090
    . "$BACKUP_ENV"
  elif dry; then
    AGE_PUBKEY="${AGE_PUBKEY:-dry-run-age-recipient}"
    log "[dry-run] missing backup env: $BACKUP_ENV"
  else
    log "missing backup env: $BACKUP_ENV"; exit 2
  fi
  if [ -z "${AGE_PUBKEY:-}" ]; then log "AGE_PUBKEY unset in $BACKUP_ENV"; exit 2; fi
  if ! dry && ! have age; then log "age unavailable"; exit 2; fi
  if ! dry && ! have gzip; then log "gzip unavailable"; exit 2; fi
}

main_backup() {
  preflight
  run mkdir -p "${WORK_DIR}/databases" "${WORK_DIR}/services" "${WORK_DIR}/configs"

  dump_container cortex-postgresql "${WORK_DIR}/databases/postgresql_all.sql.gz" pg_dumpall -U postgres
  dump_container honcho-database "${WORK_DIR}/databases/honcho_postgresql_all.sql.gz" pg_dumpall -U postgres
  dump_container cortex-mongodb "${WORK_DIR}/databases/mongodb_archive.gz" mongodump --archive
  dump_container cortex-mysql "${WORK_DIR}/databases/mysql_all.sql.gz" mysqldump --all-databases
  backup_redis cortex-redis "${WORK_DIR}/databases/redis_dump.rdb"
  backup_redis honcho-redis "${WORK_DIR}/databases/honcho_redis_dump.rdb"

  copy_path "${CORTEX_ROOT}/hermes" "${WORK_DIR}/services/hermes"
  copy_path /usr/share/ollama/.ollama "${WORK_DIR}/services/ollama-models"
  copy_path "$SECRETS_DIR" "${WORK_DIR}/configs/secrets"
  copy_path "${CORTEX_ROOT}/templates/.secrets" "${WORK_DIR}/configs/sops-templates"
  copy_glob "${WORK_DIR}/configs/systemd" '/etc/systemd/system/cortex-*' '/etc/systemd/system/hermes-*' '/etc/systemd/system/9router*' '/etc/systemd/system/ollama*'
  copy_glob "${WORK_DIR}/configs/ufw" /etc/ufw/user.rules /etc/ufw/user6.rules
  copy_glob "${WORK_DIR}/configs/docker-compose" "${CORTEX_ROOT}/stacks"/*/docker-compose.yml
  copy_path "${CORTEX_ROOT}/stacks/honcho" "${WORK_DIR}/configs/docker-compose/honcho"
  copy_from_container monitoring-grafana-1 /var/lib/grafana "${WORK_DIR}/configs/monitoring/grafana"
  copy_glob "${WORK_DIR}/configs/monitoring/prometheus" '/etc/systemd/system/prometheus*' "${CORTEX_ROOT}/monitoring/prometheus" "${CORTEX_ROOT}/stacks/monitoring/prometheus"
  copy_glob "${WORK_DIR}/configs/monitoring/loki" '/etc/systemd/system/loki*' "${CORTEX_ROOT}/monitoring/loki" "${WORK_DIR}/stacks/monitoring/loki"

  write_manifest
  if dry; then
    log "[dry-run] tar -C $BACKUP_ROOT -czf $ARCHIVE $STAMP"
    log "[dry-run] age -r AGE_PUBKEY -o $ENCRYPTED $ARCHIVE"
    log "[dry-run] rm -rf $WORK_DIR $ARCHIVE"
  else
    tar -C "$BACKUP_ROOT" -czf "$ARCHIVE" "$STAMP"
    age -r "$AGE_PUBKEY" -o "$ENCRYPTED" "$ARCHIVE"
    rm -rf "$WORK_DIR" "$ARCHIVE"
  fi
  prune_backups
  [ "$PARTIAL" -eq 0 ] || warn "backup completed with missing optional sources"
  log "Backup complete: $ENCRYPTED"
}

if [ "$PRUNE_ONLY" -eq 1 ]; then
  prune_backups
else
  main_backup
fi
