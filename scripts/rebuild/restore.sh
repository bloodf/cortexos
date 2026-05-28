#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
. "$SCRIPT_DIR/lib.sh"

usage() {
  cat <<'USAGE'
Usage: scripts/rebuild/restore.sh --list ARCHIVE_DIR
       scripts/rebuild/restore.sh --list-remote ARCHIVE_DIR
       scripts/rebuild/restore.sh --verify-remote ARCHIVE_DIR

Restore is not implemented yet. The first safe operation is listing and
verifying backup artifacts.

Options:
  --list DIR          List backup artifacts in local DIR.
  --list-remote DIR   List backup artifacts in DIR on $CORTEX_HOST.
  --verify-remote DIR Verify required backup artifacts on $CORTEX_HOST.
USAGE
}

mode=""
archive_dir=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --list)
      mode="list"
      archive_dir="${2:-}"
      [ -n "$archive_dir" ] || die "--list requires a directory"
      shift 2
      ;;
    --list-remote)
      mode="list-remote"
      archive_dir="${2:-}"
      [ -n "$archive_dir" ] || die "--list-remote requires a directory"
      shift 2
      ;;
    --verify-remote)
      mode="verify-remote"
      archive_dir="${2:-}"
      [ -n "$archive_dir" ] || die "--verify-remote requires a directory"
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

archive_dir_q="$(printf '%q' "$archive_dir")"

case "$mode" in
  list)
    [ -d "$archive_dir" ] || die "archive dir not found: $archive_dir"
    find "$archive_dir" -maxdepth 3 \( -type f -o -type d \) | sort
    ;;
  list-remote)
    ssh_host "test -d $archive_dir_q && find $archive_dir_q -maxdepth 3 \\( -type f -o -type d \\) | sort"
    ;;
  verify-remote)
    ssh_host "ARCHIVE_DIR=$archive_dir_q bash -s" <<'REMOTE'
set -Eeuo pipefail
archive_dir="${ARCHIVE_DIR:?}"
required=(
  MANIFEST
  SHA256SUMS
  archives/secrets.tgz
  archives/hermes.tgz
  archives/honcho.tgz
  archives/host-project-repos.tgz
  archives/caddy-systemd.tgz
  archives/retired-configs.tgz
  inventory/systemd-units.txt
  inventory/docker.txt
  inventory/project-repos.txt
  inventory/cortexos-files.txt
  dumps/cortex-postgresql.sql
  dumps/honcho-postgresql.sql
  repo/local-rebuild-source.tgz
)
failures=0
check_one_of() {
  local label="$1"
  shift
  local rel
  for rel in "$@"; do
    if [ -s "$archive_dir/$rel" ]; then
      printf 'ok: %s via %s\n' "$label" "$rel"
      return 0
    fi
  done
  printf 'not ok: %s\n' "$label"
  failures=$((failures + 1))
}

for rel in "${required[@]}"; do
  if [ -s "$archive_dir/$rel" ]; then
    printf 'ok: %s\n' "$rel"
  else
    printf 'not ok: %s\n' "$rel"
    failures=$((failures + 1))
  fi
done

check_one_of "mysql backup" dumps/cortex-mysql.sql archives/mysql-volume.tgz
check_one_of "mongodb backup" dumps/cortex-mongodb.archive.gz

if [ -s "$archive_dir/SHA256SUMS" ]; then
  if sha256sum -c "$archive_dir/SHA256SUMS" >/tmp/cortexos-restore-sha256.out 2>&1; then
    printf 'ok: SHA256SUMS verified\n'
  else
    printf 'not ok: SHA256SUMS verification failed\n'
    sed -n '1,40p' /tmp/cortexos-restore-sha256.out
    failures=$((failures + 1))
  fi
fi

if [ "$failures" -gt 0 ]; then
  printf 'restore verification failed: %s checks\n' "$failures" >&2
  exit 1
fi

printf 'remote restore verification passed\n'
REMOTE
    ;;
  *)
    die "restore execution is blocked; use --list, --list-remote, or --verify-remote"
    ;;
esac
