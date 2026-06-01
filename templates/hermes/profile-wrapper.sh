#!/usr/bin/env bash
set -euo pipefail

profile="${1:?profile slug is required}"
shift

export HERMES_PROFILE="$profile"
export HERMES_HOME="${CORTEX_HERMES_ROOT:?CORTEX_HERMES_ROOT is required}/profiles/$profile"

if [[ -n "${CORTEX_SECRETS_DIR:-}" && -f "${CORTEX_SECRETS_DIR}/mcp.env" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${CORTEX_SECRETS_DIR}/mcp.env"
  set +a
fi

exec "${HERMES_COMMAND:-hermes}" "$@"
