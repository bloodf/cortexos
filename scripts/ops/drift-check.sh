#!/usr/bin/env bash
# Drift check: compare repo-owned materialized artifacts against the live host.
#
# Materialization contract (what this script encodes):
#   REPO-OWNED  (overwritten on deploy, MUST match the live host):
#     - stacks/<svc>/                  -> /opt/cortexos/stacks/<svc>/
#       (the build-from-source control-plane stacks committed under stacks/)
#     - templates/systemd/<unit>       -> /etc/systemd/system/<unit>
#   HOST-MANAGED (NOT under repo stacks/, materialized at install time from
#     prompts/tools/* — reported for visibility, never treated as drift):
#     - data-plane + admin stacks (postgresql, mysql, mongodb, redis,
#       monitoring, exporters, pgadmin, ...) live only on the host.
#   HOST-OWNED  (never compared — runtime state):
#     - /opt/cortexos/.secrets/*, data volumes, logs, .setup-state.json
#
# Read-only. Requires CORTEX_HOST (e.g. export CORTEX_HOST=user@host).
# Exit 0 = no repo-owned drift; exit 1 = repo-owned drift/missing (with --strict).

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
# shellcheck disable=SC1091
. "$REPO_ROOT/scripts/rebuild/lib.sh"

STRICT=0
SHOW_DIFF=0
usage() {
  cat <<'USAGE'
Usage: scripts/ops/drift-check.sh [--strict] [--diff]

Compares repo-owned stacks/ and templates/systemd/ against the live host.

Options:
  --strict   Exit non-zero if any repo-owned artifact drifts or is missing.
  --diff     Print the unified diff for each drifted artifact.

Requires: CORTEX_HOST (user@host). Read-only on the host.
USAGE
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --strict) STRICT=1 ;;
    --diff) SHOW_DIFF=1 ;;
    -h|--help) usage; exit 0 ;;
    *) printf 'Unknown argument: %s\n' "$1" >&2; usage >&2; exit 2 ;;
  esac
  shift
done

[ -n "${CORTEX_HOST:-}" ] || die "CORTEX_HOST must be set, e.g. export CORTEX_HOST=user@host"

DRIFT=0
MATCH=0
HOSTONLY=0

# Fetch a remote file to stdout; empty output + nonzero return means absent.
remote_cat() { ssh_host "cat -- '$1' 2>/dev/null" || true; }
remote_ls()  { ssh_host "ls -1 -- '$1' 2>/dev/null" || true; }

compare_file() {
  local label="$1" local_path="$2" remote_path="$3"
  local remote_tmp
  remote_tmp="$(mktemp)"
  remote_cat "$remote_path" >"$remote_tmp"
  if [ ! -s "$remote_tmp" ]; then
    printf '  MISSING-ON-HOST  %s\n' "$label"
    DRIFT=$((DRIFT + 1)); rm -f "$remote_tmp"; return
  fi
  if diff -q "$local_path" "$remote_tmp" >/dev/null 2>&1; then
    printf '  MATCH            %s\n' "$label"
    MATCH=$((MATCH + 1))
  else
    printf '  DRIFT            %s\n' "$label"
    DRIFT=$((DRIFT + 1))
    if [ "$SHOW_DIFF" -eq 1 ]; then
      diff -u "$local_path" "$remote_tmp" | sed 's/^/      /' || true
    fi
  fi
  rm -f "$remote_tmp"
}

printf '== drift-check vs %s ==\n' "$CORTEX_HOST"

# 1. Repo-owned control-plane stacks.
printf '\n# Repo-owned stacks (stacks/ -> /opt/cortexos/stacks/)\n'
for dir in "$REPO_ROOT"/stacks/*/; do
  svc="$(basename "$dir")"
  compose="$dir/docker-compose.yml"
  [ -f "$compose" ] || continue
  compare_file "$svc/docker-compose.yml" "$compose" "/opt/cortexos/stacks/$svc/docker-compose.yml"
done

# 2. Repo-owned systemd units.
printf '\n# Repo-owned systemd units (templates/systemd/ -> /etc/systemd/system/)\n'
for unit in "$REPO_ROOT"/templates/systemd/*.service "$REPO_ROOT"/templates/systemd/*.timer; do
  [ -f "$unit" ] || continue
  name="$(basename "$unit")"
  compare_file "$name" "$unit" "/etc/systemd/system/$name"
done

# 3. Host-only inventory (informational — prompt-materialized, not drift).
printf '\n# Host-managed stacks (on host, not in repo stacks/ — prompt-materialized)\n'
repo_stacks=" $(cd "$REPO_ROOT/stacks" && echo */ | sed 's#/##g') "
while IFS= read -r hs; do
  [ -n "$hs" ] || continue
  case "$repo_stacks" in
    *" $hs "*) : ;;
    *) printf '  host-managed     %s\n' "$hs"; HOSTONLY=$((HOSTONLY + 1)) ;;
  esac
done < <(remote_ls "/opt/cortexos/stacks")

printf '\n# Host cortex-* units not declared in templates/systemd/ (review)\n'
repo_units=" $(cd "$REPO_ROOT/templates/systemd" && echo ./*.service ./*.timer | sed 's#\./##g') "
while IFS= read -r hu; do
  [ -n "$hu" ] || continue
  case "$repo_units" in
    *" $hu "*) : ;;
    *) printf '  host-only-unit   %s\n' "$hu" ;;
  esac
done < <(ssh_host "ls -1 /etc/systemd/system/cortex-*.service /etc/systemd/system/cortex-*.timer 2>/dev/null | xargs -r -n1 basename" || true)

printf '\n== summary: %d match, %d repo-owned drift/missing, %d host-managed stacks ==\n' \
  "$MATCH" "$DRIFT" "$HOSTONLY"

if [ "$STRICT" -eq 1 ] && [ "$DRIFT" -gt 0 ]; then
  exit 1
fi
exit 0
