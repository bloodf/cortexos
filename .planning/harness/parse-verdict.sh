#!/usr/bin/env bash
# Extract critic verdict from an artifact.
# Usage: parse-verdict.sh <artifact>
# Exit: 0 = PASS, 1 = REJECT, 2 = file missing/empty or no verdict line.
# Tolerates leading non-alpha characters (kimi prefixes lines with "• ").
set -uo pipefail

F="${1:?usage: parse-verdict.sh <artifact>}"
F="$(readlink -f "$F" 2>/dev/null || true)"
if [ -z "$F" ] || [ ! -s "$F" ]; then
  echo "NO-VERDICT: artifact missing or empty: ${1}"
  exit 2
fi

LINE="$(grep -m1 -E '^[^A-Za-z]*VERDICT:[[:space:]]*(PASS|REJECT)' "$F" || true)"
case "$LINE" in
  *REJECT*) echo "REJECT"; exit 1 ;;
  *PASS*)   echo "PASS";   exit 0 ;;
  *)        echo "NO-VERDICT: no 'VERDICT: PASS|REJECT' line in $F"; exit 2 ;;
esac
