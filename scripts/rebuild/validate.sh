#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
. "$SCRIPT_DIR/lib.sh"

usage() {
  cat <<'USAGE'
Usage: scripts/rebuild/validate.sh [--local]

Validate repo-local rebuild artifacts. This command is read-only.

Options:
  --local   Required for now; validates local files only.
USAGE
}

local_only=0
while [ "$#" -gt 0 ]; do
  case "$1" in
    --local)
      local_only=1
      shift
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

[ "$local_only" -eq 1 ] || die "only --local validation is implemented at this phase"

failures=0
check() {
  local label="$1"
  shift
  if "$@"; then
    printf 'ok: %s\n' "$label"
  else
    printf 'not ok: %s\n' "$label"
    failures=$((failures + 1))
  fi
}

check "PLAN.md exists" test -f "$REBUILD_ROOT/PLAN.md"
check "manifest directory exists" test -d "$MANIFEST_DIR"

for f in \
  service-placement.tsv \
  retired-systems.txt \
  protected-hermes.txt \
  projects.tsv \
  backup-scope.tsv \
  secrets.manifest.tsv \
  validation-gates.tsv \
  mcp-global-allowlist.txt \
  tmux-plugins.txt \
  tmux-session-model.tsv \
  incus-base-image.tsv \
  dashboard-helper-audit.sql \
  dashboard-helper-log-format.json \
  runtime-retired.tsv \
  runtime-protected.tsv; do
  check "manifest $f exists" test -f "$MANIFEST_DIR/$f"
done

check "protected Hermes includes cieucpb" grep -qx 'cieucpb' "$MANIFEST_DIR/protected-hermes.txt"
check "protected Hermes includes netbook" grep -qx 'netbook' "$MANIFEST_DIR/protected-hermes.txt"
check "protected Hermes includes cortex" grep -qx 'cortex' "$MANIFEST_DIR/protected-hermes.txt"
check "retired Paperclip declared" grep -qx 'paperclip' "$MANIFEST_DIR/retired-systems.txt"
check "retired NATS declared" grep -qx 'nats' "$MANIFEST_DIR/retired-systems.txt"
check "Incus unprivileged decision recorded" grep -q 'Unprivileged' "$REBUILD_ROOT/PLAN.md"
check "local backup root recorded" grep -q '/mnt/hdd/cortexos-backups' "$REBUILD_ROOT/PLAN.md"
check "tmux resurrect declared" grep -qx 'tmux-plugins/tmux-resurrect' "$MANIFEST_DIR/tmux-plugins.txt"
check "tmux continuum declared" grep -qx 'tmux-plugins/tmux-continuum' "$MANIFEST_DIR/tmux-plugins.txt"
check "root helper audit schema declared" grep -q 'dashboard_command_audit' "$MANIFEST_DIR/dashboard-helper-audit.sql"
check "Incus base image matches host OS" grep -q 'ubuntu-26.04' "$MANIFEST_DIR/incus-base-image.tsv"
check "runtime retired includes paperclip" grep -q $'systemd_unit\tpaperclip.service\t' "$MANIFEST_DIR/runtime-retired.tsv"
check "runtime protected includes cieucpb" grep -q 'hermes-profile@cieucpb.service' "$MANIFEST_DIR/runtime-protected.tsv"
check "bootstrap prompt points to PLAN.md" grep -q 'PLAN.md' "$REBUILD_ROOT/prompts/00-bootstrap.md"
check "tool order retired old spoke graph" grep -q 'old spoke dependency graph is retired' "$REBUILD_ROOT/prompts/tools/_order.md"

for s in inventory.sh plan.sh validate.sh backup.sh restore.sh apply.sh; do
  check "script $s exists" test -f "$SCRIPT_DIR/$s"
  check "script $s has valid bash syntax" bash -n "$SCRIPT_DIR/$s"
  check "script $s is executable" test -x "$SCRIPT_DIR/$s"
done

if [ "$failures" -gt 0 ]; then
  die "$failures validation checks failed"
fi

printf 'local validation passed\n'
