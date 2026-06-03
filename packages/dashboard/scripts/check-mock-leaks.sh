#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# scripts/check-mock-leaks.sh
#
# Layer 3 of the mocks-cannot-leak-into-prod guard.
#
# Greps `src/` (excluding the mocks folder and tests) for any import
# of `$lib/mocks` or a relative path into `../mocks` / `./mocks`. Any
# hit is a CI-blocking error: the mocks layer is reserved for the
# SvelteKit `hooks.server.ts`, the `mocks/browser.ts` and
# `mocks/server.ts` entries, and test files only.
#
# Exit codes:
#   0  clean (no leaks)
#   1  one or more leaks (CI fails)
# ─────────────────────────────────────────────────────────────────────
set -eo pipefail

PACKAGE_DIR="${1:-$(cd "$(dirname "$0")/.." && pwd)}"
SRC_DIR="$PACKAGE_DIR/src"

if [ ! -d "$SRC_DIR" ]; then
  echo "check-mock-leaks: src dir not found at $SRC_DIR" >&2
  exit 2
fi

# Build a single extended-regex expression from the leak patterns.
# We avoid bash array expansion under `set -u` (and the headache of
# nested backslash escaping) by writing the alternation directly.
LEAK_REGEX='from .*(\$lib/mocks|\.\./mocks|\./mocks|\.\./\.\./mocks)|import\(.*\$lib/mocks|require\(.*\$lib/mocks'

# Files that ARE allowed to import from $lib/mocks.
ALLOWLIST_REGEX='^(src/lib/mocks/|src/hooks\.server\.ts|src/lib/mocks/prod-leak-guard\.ts|__tests__/)'

echo "check-mock-leaks: scanning $SRC_DIR for mocks imports…"

# Grep recursively, exclude node_modules and the mocks folder itself.
RAW_LEAKS=$(
  grep -RInE --include='*.ts' --include='*.svelte' --include='*.tsx' \
    --exclude-dir='node_modules' --exclude-dir='mocks' \
    -e "$LEAK_REGEX" "$SRC_DIR" 2>/dev/null || true
)

# Filter out allowlist paths.
FILTERED=$(printf '%s\n' "$RAW_LEAKS" | grep -vE "$ALLOWLIST_REGEX" || true)

if [ -z "$FILTERED" ]; then
  echo "check-mock-leaks: OK (no leaks)"
  exit 0
fi

echo "check-mock-leaks: LEAKS DETECTED"
echo "================================="
printf '%s\n' "$FILTERED"
echo "================================="
echo
echo "Mocks are imported from forbidden paths. Move the import to:"
echo "  - src/hooks.server.ts (server layer)"
echo "  - src/lib/mocks/browser.ts (browser MSW)"
echo "  - src/lib/mocks/server.ts (server handle)"
echo "  - a test file under src/**/__tests__/"
echo
exit 1
