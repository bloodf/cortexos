#!/usr/bin/env bash
# cortex-env-writer.sh — atomic env-file writer called by cortex-dashboard-env-writer.service
# Reads JSON from stdin: { "path": "/opt/cortexos/.secrets/foo.env", "updates": [{"key":"K","value":"V"}] }
# Validates path against allowlist, writes atomically via tmp+rename.
#
# Security: path must start with an allowlisted prefix. No shell injection: keys validated.
set -euo pipefail

# ---------------------------------------------------------------------------
# Allowlist — only paths under these roots are writable
# ---------------------------------------------------------------------------
ALLOWED_PREFIXES=(
  "/opt/cortexos/.secrets/"
  "/opt/cortexos/stacks/"
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
die() { printf '[cortex-env-writer] ERROR: %s\n' "$*" >&2; exit 1; }
log() { printf '[cortex-env-writer] %s\n' "$*"; }

validate_path() {
  local target="$1"
  # Resolve to real path (no symlink tricks)
  local real
  real="$(realpath -m "$target")" || die "realpath failed for: $target"

  for prefix in "${ALLOWED_PREFIXES[@]}"; do
    if [[ "$real" == "$prefix"* ]]; then
      echo "$real"
      return 0
    fi
  done
  die "path not in allowlist: $real"
}

validate_key() {
  local key="$1"
  [[ "$key" =~ ^[A-Z0-9_]+$ ]] || die "invalid env key: $key (must match [A-Z0-9_]+)"
}

# ---------------------------------------------------------------------------
# Read input JSON from stdin
# ---------------------------------------------------------------------------
INPUT="$(cat)"
if [[ -z "$INPUT" ]]; then
  die "no input on stdin"
fi

# Parse with python3 (always available on Ubuntu VPS)
PARSED="$(python3 - <<PYEOF
import json, sys
data = json.loads(sys.stdin.read())
target = data.get('path', '')
updates = data.get('updates', [])
print(target)
for u in updates:
    key = u.get('key', '')
    value = u.get('value', '')
    # Escape newlines in value for line protocol
    value = value.replace('\\\\', '\\\\\\\\').replace('\\n', '\\\\n')
    print(f'{key}={value}')
PYEOF
)" <<< "$INPUT" || die "failed to parse JSON input"

TARGET_PATH="$(echo "$PARSED" | head -n1)"
UPDATES="$(echo "$PARSED" | tail -n+2)"

[[ -n "$TARGET_PATH" ]] || die "path missing in input"
[[ -n "$UPDATES" ]] || die "no updates provided"

REAL_PATH="$(validate_path "$TARGET_PATH")"
log "writing to $REAL_PATH"

# ---------------------------------------------------------------------------
# Read existing env file (if any)
# ---------------------------------------------------------------------------
declare -A ENV_MAP
if [[ -f "$REAL_PATH" ]]; then
  while IFS= read -r line || [[ -n "$line" ]]; do
    # Skip blanks and comments
    [[ -z "$line" || "$line" == '#'* ]] && continue
    if [[ "$line" =~ ^([A-Z0-9_]+)=(.*)$ ]]; then
      ENV_MAP["${BASH_REMATCH[1]}"]="${BASH_REMATCH[2]}"
    fi
  done < "$REAL_PATH"
fi

# ---------------------------------------------------------------------------
# Apply updates
# ---------------------------------------------------------------------------
while IFS= read -r update_line || [[ -n "$update_line" ]]; do
  [[ -z "$update_line" ]] && continue
  KEY="${update_line%%=*}"
  VALUE="${update_line#*=}"
  validate_key "$KEY"
  ENV_MAP["$KEY"]="$VALUE"
done <<< "$UPDATES"

# ---------------------------------------------------------------------------
# Write atomically
# ---------------------------------------------------------------------------
TMPFILE="${REAL_PATH}.tmp.$$"
trap 'rm -f "$TMPFILE"' EXIT

{
  printf '# Updated by cortex-dashboard-env-writer at %s\n' "$(date -u +%FT%TZ)"
  for key in $(echo "${!ENV_MAP[@]}" | tr ' ' '\n' | sort); do
    printf '%s=%s\n' "$key" "${ENV_MAP[$key]}"
  done
} > "$TMPFILE"

# Preserve permissions of original file if it exists
if [[ -f "$REAL_PATH" ]]; then
  chmod --reference="$REAL_PATH" "$TMPFILE" || true
else
  chmod 600 "$TMPFILE"
fi

mv "$TMPFILE" "$REAL_PATH"
log "wrote $(echo "${!ENV_MAP[@]}" | wc -w) keys to $REAL_PATH"
