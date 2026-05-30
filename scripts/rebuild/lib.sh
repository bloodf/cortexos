#!/usr/bin/env bash
set -Eeuo pipefail

REBUILD_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MANIFEST_DIR="${REBUILD_ROOT}/manifests/rebuild"
CORTEX_HOST="${CORTEX_HOST:-}"
BACKUP_ROOT="${BACKUP_ROOT:-/mnt/hdd/cortexos-backups}"

die() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

log() {
  printf '[rebuild] %s\n' "$*" >&2
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "missing required command: $1"
}

timestamp_utc() {
  date -u +%Y%m%dT%H%M%SZ
}

manifest_path() {
  local name="$1"
  printf '%s/%s\n' "$MANIFEST_DIR" "$name"
}

require_manifest() {
  local path
  path="$(manifest_path "$1")"
  [ -f "$path" ] || die "missing manifest: $path"
  printf '%s\n' "$path"
}

print_tsv() {
  local path="$1"
  if command -v column >/dev/null 2>&1; then
    column -t -s $'\t' <"$path"
  else
    sed 's/\t/  /g' "$path"
  fi
}

ssh_host() {
  require_cmd ssh
  [ -n "$CORTEX_HOST" ] || die "CORTEX_HOST must be set, e.g. export CORTEX_HOST=user@host"
  ssh -o BatchMode=yes -o ConnectTimeout=12 "$CORTEX_HOST" "$@"
}

ensure_output_dir() {
  local dir="$1"
  mkdir -p "$dir"
  printf '%s\n' "$dir"
}

write_section() {
  local title="$1"
  printf '\n## %s\n\n' "$title"
}

copy_manifest_snapshot() {
  local output_dir="$1"
  mkdir -p "$output_dir/manifests"
  cp -R "$MANIFEST_DIR/." "$output_dir/manifests/"
}

redact_secret_path_list() {
  sed -E 's#(/opt/cortexos/\.secrets/[^[:space:]]+)#\1#g'
}
