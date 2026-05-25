#!/usr/bin/env bash
# scan-minimax-deps.sh — grep active workflows for MiniMax plugin refs.
# Exits non-zero if any reference found.
set -euo pipefail

SEARCH_ROOTS=(
  "/opt/cortexos/stacks"
  "/opt/cortexos/.openclaw"
  "${HOME}/.openclaw"
)

PATTERNS=(
  "minimax"
  "MiniMax"
  "openclaw-minimax"
  "minimax-plugin"
)

log() { printf '[scan-minimax] %s\n' "$*"; }

found=0
for root in "${SEARCH_ROOTS[@]}"; do
  [[ -d "$root" ]] || continue
  for pattern in "${PATTERNS[@]}"; do
    if grep -rq "$pattern" "$root" 2>/dev/null; then
      matches="$(grep -rl "$pattern" "$root" 2>/dev/null)"
      log "FOUND '$pattern' in:"
      while IFS= read -r f; do log "  $f"; done <<< "$matches"
      found=1
    fi
  done
done

if [[ "$found" -eq 1 ]]; then
  log "RESULT: MiniMax plugin references found — review before dropping plugin."
  exit 1
else
  log "RESULT: No MiniMax plugin references found — safe to drop."
  exit 0
fi
