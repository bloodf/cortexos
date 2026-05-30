#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
. "$SCRIPT_DIR/lib.sh"

usage() {
  cat <<'USAGE'
Usage: scripts/rebuild/backup.sh [--dry-run|--execute] [--backup-id ID]

Prepare or run the backup/export phase. --execute writes a local-only backup on
the CortexOS host under /mnt/hdd/cortexos-backups.

Options:
  --dry-run   Print backup actions without mutating the host.
  --execute   Create backup artifacts on the host.
  --backup-id Override timestamp backup id.
USAGE
}

dry_run=0
execute=0
backup_id=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --dry-run)
      dry_run=1
      shift
      ;;
    --execute)
      execute=1
      shift
      ;;
    --backup-id)
      backup_id="${2:-}"
      [ -n "$backup_id" ] || die "--backup-id requires a value"
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

if [ "$dry_run" -eq "$execute" ]; then
  die "choose exactly one of --dry-run or --execute"
fi

if [ -z "$backup_id" ]; then
  backup_id="$(timestamp_utc)"
fi

remote_backup_dir="$BACKUP_ROOT/$backup_id"

write_section "Backup Root"
printf '%s\n' "$remote_backup_dir"

write_section "Backup Scope"
print_tsv "$(require_manifest backup-scope.tsv)"

if [ "$dry_run" -eq 1 ]; then
  write_section "Planned Remote Checks"
  cat <<EOF
ssh $CORTEX_HOST 'test -d /mnt/hdd && test -w /mnt/hdd'
ssh $CORTEX_HOST 'mkdir -p $remote_backup_dir'
ssh $CORTEX_HOST 'pg_dumpall ...'
ssh $CORTEX_HOST 'mysqldump ...'
ssh $CORTEX_HOST 'mongodump ...'
ssh $CORTEX_HOST 'tar ... /opt/cortexos/hermes /opt/cortexos/.secrets /etc/caddy /etc/systemd/system'
EOF

  printf '\ndry-run only: no backup was created\n'
  exit 0
fi

"$SCRIPT_DIR/validate.sh" --local >/dev/null
require_cmd tar
require_cmd scp

remote_backup_dir_q="$(printf '%q' "$remote_backup_dir")"
log "creating remote backup at $remote_backup_dir"

ssh_host "BACKUP_DIR=$remote_backup_dir_q bash -s" <<'REMOTE'
set -Eeuo pipefail
umask 077

backup_dir="${BACKUP_DIR:?}"
backup_parent="$(dirname "$backup_dir")"

if sudo -n true 2>/dev/null; then
  SUDO="sudo -n"
else
  SUDO=""
fi

if [ -n "$SUDO" ]; then
  # shellcheck disable=SC2086
  $SUDO mkdir -p "$backup_parent" "$backup_dir"
  # shellcheck disable=SC2086
  $SUDO chown "$(id -u):$(id -g)" "$backup_parent" "$backup_dir"
  # shellcheck disable=SC2086
  $SUDO chmod 700 "$backup_parent" "$backup_dir"
fi

mkdir -p "$backup_dir"/{archives,dumps,inventory,metadata,repo}

run_shell_capture() {
  local path="$1"
  local script="$2"
  {
    printf '$ %s\n' "$script"
    bash -lc "$script"
  } >"$backup_dir/$path" 2>&1 || true
}

archive_if_exists() {
  local output="$1"
  shift
  local existing=()
  local path
  for path in "$@"; do
    if [ -e "$path" ]; then
      existing+=("$path")
    fi
  done
  if [ "${#existing[@]}" -eq 0 ]; then
    printf 'missing\n' >"$backup_dir/metadata/${output}.missing"
    return 0
  fi
  if [ -n "$SUDO" ]; then
    # shellcheck disable=SC2086
    $SUDO tar \
      --exclude=node_modules \
      --exclude=.pnpm \
      --exclude=.next \
      --exclude=vendor \
      --exclude=__pycache__ \
      -czf "$backup_dir/archives/$output.tgz" "${existing[@]}" \
      >"$backup_dir/metadata/${output}.tar.log" 2>&1 || true
    # shellcheck disable=SC2086
    $SUDO chown "$(id -u):$(id -g)" "$backup_dir/archives/$output.tgz" 2>/dev/null || true
  else
    tar \
      --exclude=node_modules \
      --exclude=.pnpm \
      --exclude=.next \
      --exclude=vendor \
      --exclude=__pycache__ \
      -czf "$backup_dir/archives/$output.tgz" "${existing[@]}" \
      >"$backup_dir/metadata/${output}.tar.log" 2>&1 || true
  fi
}

run_shell_capture metadata/host.txt 'date -u; hostname; grep -E "^(PRETTY_NAME|VERSION_CODENAME)=" /etc/os-release; uname -srmo; id; groups'
run_shell_capture inventory/systemd-units.txt 'systemctl list-units --type=service --all --no-pager --plain --no-legend | sort'
run_shell_capture inventory/systemd-unit-files.txt 'systemctl list-unit-files --type=service --no-pager --plain --no-legend | sort'
run_shell_capture inventory/timers.txt 'systemctl list-timers --all --no-pager --plain || true'
run_shell_capture inventory/listening-ports.txt 'ss -ltnup 2>/dev/null || true'
run_shell_capture inventory/packages.txt 'apt-mark showmanual 2>/dev/null | sort; printf "\n--- snap ---\n"; snap list 2>/dev/null || true; printf "\n--- npm-global ---\n"; npm ls -g --depth=0 2>/dev/null || true'
run_shell_capture inventory/docker.txt 'docker ps --format "{{.Names}}|{{.Image}}|{{.Ports}}|{{.Label \"com.docker.compose.project\"}}|{{.Label \"com.docker.compose.project.working_dir\"}}" | sort; printf "\n--- compose ---\n"; docker compose ls --format json 2>/dev/null || true; printf "\n--- volumes ---\n"; docker volume ls 2>/dev/null || true'
run_shell_capture inventory/caddy.txt 'find /etc/caddy -maxdepth 3 -type f -printf "%m %u %g %p\n" 2>/dev/null | sort; printf "\nCADDY_VALIDATE\n"; caddy validate --config /etc/caddy/Caddyfile 2>&1 || true'
run_shell_capture inventory/tailscale.txt 'tailscale status --json 2>/dev/null | jq "{Version,TUN,BackendState,HaveNodeKey,TailscaleIPs,Self:(.Self | {HostName,DNSName,OS,TailscaleIPs,KeyExpiry,Online}),Health,MagicDNSSuffix,CurrentTailnet:(.CurrentTailnet | {MagicDNSSuffix,MagicDNSEnabled}),CertDomains}" 2>/dev/null || tailscale status --json 2>/dev/null || true; printf "\nTAILSCALE_SERVE\n"; tailscale serve status 2>/dev/null || true'
run_shell_capture inventory/cortexos-files.txt 'printf "HERMES_PROFILES\n"; find /opt/cortexos/hermes/profiles -maxdepth 1 -mindepth 1 -type d 2>/dev/null | sed "s#.*/##" | sort; printf "\nSECRETS_METADATA\n"; find /opt/cortexos/.secrets -maxdepth 3 -type f -printf "%m %u %g %p\n" 2>/dev/null | sort'
run_shell_capture inventory/project-repos.txt 'for name in celebrar.me mementry 3guns; do printf "PROJECT_NAME %s\n" "$name"; find /home/cortexos/Developer -path "*/$name/.git" -type d -prune 2>/dev/null | while IFS= read -r gitdir; do d=${gitdir%/.git}; printf "PROJECT %s\n" "$d"; git -C "$d" remote -v | sed -n "1,2p"; git -C "$d" rev-parse --abbrev-ref HEAD; git -C "$d" status --short | sed -n "1,200p"; done; done'
run_shell_capture inventory/incus.txt 'if command -v incus >/dev/null 2>&1; then incus list; incus storage list; else echo "incus not installed"; fi'

archive_if_exists secrets /opt/cortexos/.secrets
archive_if_exists hermes /opt/cortexos/hermes
archive_if_exists honcho /opt/cortexos/stacks/honcho /opt/cortexos/data/honcho
archive_if_exists caddy-systemd /etc/caddy /etc/systemd/system /opt/cortexos/systemd
archive_if_exists cortexos-configs /opt/cortexos/templates /opt/cortexos/prompts /opt/cortexos/scripts /opt/cortexos/schemas /opt/cortexos/packages /opt/cortexos/stacks
archive_if_exists retired-configs /opt/cortexos/paperclip /opt/cortexos/stacks/paperclip /opt/cortexos/stacks/floci /opt/cortexos/stacks/cortex-langfuse /opt/cortexos/packages/paperclip-adapter /opt/cortexos/templates/agent-factory /opt/cortexos/templates/agentgateway
archive_if_exists host-project-repos /home/cortexos/Developer

if [ -d /opt/cortexos/.git ]; then
  git -C /opt/cortexos rev-parse HEAD >"$backup_dir/repo/opt-cortexos-head.txt" 2>&1 || true
  git -C /opt/cortexos status --short >"$backup_dir/repo/opt-cortexos-status.txt" 2>&1 || true
  git -C /opt/cortexos diff >"$backup_dir/repo/opt-cortexos.diff" 2>&1 || true
  git -C /opt/cortexos bundle create "$backup_dir/repo/opt-cortexos.bundle" --all >"$backup_dir/repo/opt-cortexos-bundle.log" 2>&1 || true
fi

if docker ps --format '{{.Names}}' 2>/dev/null | grep -qx cortex-postgresql; then
  docker exec cortex-postgresql sh -lc 'pg_dumpall -U "$POSTGRES_USER"' >"$backup_dir/dumps/cortex-postgresql.sql" 2>"$backup_dir/dumps/cortex-postgresql.err" || true
fi

if docker ps --format '{{.Names}}' 2>/dev/null | grep -qx honcho-database; then
  docker exec honcho-database pg_dumpall -U postgres >"$backup_dir/dumps/honcho-postgresql.sql" 2>"$backup_dir/dumps/honcho-postgresql.err" || true
fi

if docker ps --format '{{.Names}}' 2>/dev/null | grep -qx cortex-mysql; then
  if ! docker exec cortex-mysql sh -lc 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqldump -uroot --all-databases --single-transaction --routines --events' >"$backup_dir/dumps/cortex-mysql.sql" 2>"$backup_dir/dumps/cortex-mysql.err"; then
    mysql_volume="$(docker inspect cortex-mysql --format '{{range .Mounts}}{{if eq .Destination "/var/lib/mysql"}}{{.Source}}{{end}}{{end}}' 2>/dev/null || true)"
    if [ -n "$mysql_volume" ]; then
      if [ -n "$SUDO" ]; then
        if ! $SUDO test -d "$mysql_volume"; then
          printf 'missing mysql volume path: %s\n' "$mysql_volume" >"$backup_dir/metadata/mysql-volume.missing"
        else
          # shellcheck disable=SC2086
          $SUDO tar -czf "$backup_dir/archives/mysql-volume.tgz" -C "$mysql_volume" . >"$backup_dir/metadata/mysql-volume.tar.log" 2>&1 || true
          # shellcheck disable=SC2086
          $SUDO chown "$(id -u):$(id -g)" "$backup_dir/archives/mysql-volume.tgz" 2>/dev/null || true
        fi
      else
        if [ -d "$mysql_volume" ]; then
          tar -czf "$backup_dir/archives/mysql-volume.tgz" -C "$mysql_volume" . >"$backup_dir/metadata/mysql-volume.tar.log" 2>&1 || true
        fi
      fi
    fi
  fi
fi

if docker ps --format '{{.Names}}' 2>/dev/null | grep -qx cortex-mongodb; then
  docker exec cortex-mongodb sh -lc 'mongodump -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --archive --gzip' >"$backup_dir/dumps/cortex-mongodb.archive.gz" 2>"$backup_dir/dumps/cortex-mongodb.err" || true
fi

docker cp cortex-redis:/data/dump.rdb "$backup_dir/dumps/cortex-redis-dump.rdb" >"$backup_dir/dumps/cortex-redis.err" 2>&1 || true
docker cp honcho-redis:/data/dump.rdb "$backup_dir/dumps/honcho-redis-dump.rdb" >"$backup_dir/dumps/honcho-redis.err" 2>&1 || true

printf 'backup_dir=%s\ncreated_at=%s\n' "$backup_dir" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >"$backup_dir/MANIFEST"
find "$backup_dir" -type f ! -name SHA256SUMS -exec sha256sum {} + | sort >"$backup_dir/SHA256SUMS"
find "$backup_dir" -type d -exec chmod 700 {} +
find "$backup_dir" -type f -exec chmod 600 {} +
REMOTE

source_archive="/tmp/cortexos-rebuild-source-$backup_id.tgz"
tar -C "$REBUILD_ROOT" -czf "$source_archive" \
  PLAN.md \
  docs/rebuild \
  manifests/rebuild \
  prompts/00-bootstrap.md \
  prompts/tools/_order.md \
  scripts/rebuild

scp -q "$source_archive" "$CORTEX_HOST:$remote_backup_dir/repo/local-rebuild-source.tgz"
rm -f "$source_archive"
ssh_host "find $remote_backup_dir_q -type f ! -name SHA256SUMS -exec sha256sum {} + | sort > $remote_backup_dir_q/SHA256SUMS"

write_section "Created Artifacts"
ssh_host "find $remote_backup_dir_q -maxdepth 2 -type f | sort"
