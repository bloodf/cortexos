#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
. "$SCRIPT_DIR/lib.sh"

usage() {
  cat <<'USAGE'
Usage: scripts/rebuild/plan.sh

Print the current rebuild plan from manifests. This command is read-only.
USAGE
}

case "${1:-}" in
  -h|--help)
    usage
    exit 0
    ;;
  "")
    ;;
  *)
    die "unknown argument: $1"
    ;;
esac

write_section "Service Placement"
print_tsv "$(require_manifest service-placement.tsv)"

write_section "Projects"
print_tsv "$(require_manifest projects.tsv)"

write_section "Incus Base Image"
print_tsv "$(require_manifest incus-base-image.tsv)"

write_section "Protected Hermes"
grep -v '^#' "$(require_manifest protected-hermes.txt)" | sed '/^$/d'

write_section "Retired Systems"
grep -v '^#' "$(require_manifest retired-systems.txt)" | sed '/^$/d'

write_section "Retired Runtime Cleanup"
print_tsv "$(require_manifest runtime-retired.tsv)"

write_section "Protected Runtime"
print_tsv "$(require_manifest runtime-protected.tsv)"

write_section "Tmux Plugins"
grep -v '^#' "$(require_manifest tmux-plugins.txt)" | sed '/^$/d'

write_section "Tmux Session Model"
print_tsv "$(require_manifest tmux-session-model.tsv)"

write_section "Validation Gates"
print_tsv "$(require_manifest validation-gates.tsv)"

write_section "Backup Scope"
print_tsv "$(require_manifest backup-scope.tsv)"
