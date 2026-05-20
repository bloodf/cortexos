#!/usr/bin/env bash
# probe-openclaw-gateway.sh
#
# BLOCKS-gate: verifies the OpenClaw HTTP gateway exposes every endpoint
# the dashboard depends on. Run this against a live OpenClaw installation
# before writing any client code.
#
# Exit codes:
#   0 — all required endpoints present
#   1 — one or more endpoints MISSING
#   2 — environmental error (missing tool, connection refused, etc.)
#
# Env vars:
#   OPENCLAW_BASE     — gateway base URL (default: http://127.0.0.1:18789)
#   SNAPSHOT_DIR      — directory for transient snapshot output (default: /opt/cortexos/.cache/external-docs)
#   SNAPSHOT_FILE     — snapshot file path (default: $SNAPSHOT_DIR/openclaw-gateway-api.snapshot.md)

set -euo pipefail

OPENCLAW_BASE="${OPENCLAW_BASE:-http://127.0.0.1:18789}"
SNAPSHOT_DIR="${SNAPSHOT_DIR:-/opt/cortexos/.cache/external-docs}"
SNAPSHOT_FILE="${SNAPSHOT_FILE:-$SNAPSHOT_DIR/openclaw-gateway-api.snapshot.md}"

# Required endpoints
ENDPOINTS=(
  installPlugin
  configurePlugin
  setupOpenViking
  setConfig
  registerRoute
  listChannels
  sendMessage
  listAccounts
  pluginStatus
  health
)

# ── dependency checks ────────────────────────────────────────────────────────

missing_tools=()
command -v curl >/dev/null 2>&1 || missing_tools+=(curl)
command -v jq   >/dev/null 2>&1 || missing_tools+=(jq)

if [[ ${#missing_tools[@]} -gt 0 ]]; then
  printf '[ERROR] Required tools not found: %s\n' "${missing_tools[*]}" >&2
  # Detect family via repo-local pkg.sh if available; fallback to a generic hint.
  __probe_repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
  if [[ -f "${__probe_repo_root}/scripts/pkg.sh" ]]; then
    # shellcheck source=/dev/null
    source "${__probe_repo_root}/scripts/pkg.sh"
    case "$(pkg_family)" in
      ubuntu|debian) printf '        Install: sudo apt-get install -y %s\n' "${missing_tools[*]}" >&2 ;;
      *)             printf '        Install: brew install %s   # macOS / unknown family\n' "${missing_tools[*]}" >&2 ;;
    esac
  else
    printf '        Install via your package manager (apt-get install / brew install): %s\n' "${missing_tools[*]}" >&2
  fi
  exit 2
fi

# ── helpers ──────────────────────────────────────────────────────────────────

probe_endpoint() {
  local ep="$1"
  local url="${OPENCLAW_BASE}/${ep}"
  local http_code body

  # Attempt OPTIONS first (cheapest probe)
  http_code=$(curl -sS -o /dev/null -w '%{http_code}' \
    --max-time 5 \
    -X OPTIONS "$url" 2>/dev/null) || true

  if [[ "$http_code" == "000" ]]; then
    # Connection refused or network error
    printf 'ABORT\n'
    return
  fi

  if [[ "$http_code" == "404" ]]; then
    # OPTIONS returned 404 — try POST with empty body
    local post_out
    post_out=$(curl -sS -w '\n%{http_code}' \
      --max-time 5 \
      -X POST "$url" \
      -H 'Content-Type: application/json' \
      -d '{}' 2>/dev/null) || true

    local post_code
    post_code=$(printf '%s' "$post_out" | tail -n1)
    body=$(printf '%s' "$post_out" | head -n -1)

    if [[ "$post_code" == "000" ]]; then
      printf 'ABORT\n'
      return
    fi

    if [[ "$post_code" == "404" ]]; then
      printf 'MISSING\n'
      return
    fi

    # Any non-404 non-connection-error response means endpoint exists
    printf 'OK:%s:%s\n' "$post_code" "$body"
    return
  fi

  # OPTIONS returned something other than 404 — endpoint exists
  body=$(curl -sS --max-time 5 -X GET "$url" 2>/dev/null || true)
  printf 'OK:%s:%s\n' "$http_code" "$body"
}

truncate_body() {
  # Collapse whitespace and truncate to ~500 chars
  printf '%s' "$1" | tr -s '[:space:]' ' ' | cut -c1-500
}

# ── main probe loop ──────────────────────────────────────────────────────────

declare -A ep_status
declare -A ep_http
declare -A ep_body

printf '\nProbing OpenClaw gateway: %s\n' "$OPENCLAW_BASE"
printf '%s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
printf -- '---------------------------------------------\n'

any_abort=0
any_missing=0

for ep in "${ENDPOINTS[@]}"; do
  result=$(probe_endpoint "$ep")

  if [[ "$result" == "ABORT" ]]; then
    printf '[ABORT] %s — connection refused. Is OpenClaw running?\n' "$ep" >&2
    any_abort=1
    ep_status[$ep]="ABORT"
    ep_http[$ep]="N/A"
    ep_body[$ep]=""
  elif [[ "$result" == "MISSING" ]]; then
    ep_status[$ep]="MISSING"
    ep_http[$ep]="404"
    ep_body[$ep]=""
    any_missing=1
  else
    code=$(printf '%s' "$result" | cut -d: -f2)
    body=$(printf '%s' "$result" | cut -d: -f3-)
    ep_status[$ep]="OK"
    ep_http[$ep]="$code"
    ep_body[$ep]=$(truncate_body "$body")
  fi
done

# ── result table ─────────────────────────────────────────────────────────────

printf '\n%-28s %-10s %s\n' "ENDPOINT" "STATUS" "HTTP"
printf -- '%-28s %-10s %s\n' "--------" "------" "----"
for ep in "${ENDPOINTS[@]}"; do
  printf '%-28s %-10s %s\n' "$ep" "${ep_status[$ep]}" "${ep_http[$ep]}"
done

# ── health snapshot ──────────────────────────────────────────────────────────

health_body=""
version_banner=""

if [[ "${ep_status[health]:-}" == "OK" ]]; then
  health_body=$(curl -sS --max-time 5 "${OPENCLAW_BASE}/health" 2>/dev/null || true)
  version_banner=$(curl -sS --max-time 5 "${OPENCLAW_BASE}/version" 2>/dev/null || true)
fi

# ── snapshot write ───────────────────────────────────────────────────────────

mkdir -p "$SNAPSHOT_DIR"

{
  printf '<!-- Snapshot of upstream OpenClaw HTTP gateway at probe time. NOT a version pin. Operator reinstalls latest upstream on each fresh install. -->\n\n'
  printf '# OpenClaw Gateway API Snapshot\n\n'
  printf '**Probe timestamp:** %s  \n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  printf '**Base URL:** %s  \n' "$OPENCLAW_BASE"
  if [[ -n "$version_banner" ]]; then
    printf '**Version banner:** %s  \n' "$(truncate_body "$version_banner")"
  fi
  printf '\n> This snapshot is a guide for implementors, NOT a version pin.\n'
  printf '> Reinstall latest upstream on each fresh provisioning run.\n\n'
  printf '## Summary Table\n\n'
  printf '| Endpoint | Status | HTTP |\n'
  printf '|----------|--------|------|\n'
  for ep in "${ENDPOINTS[@]}"; do
    printf '| %s | %s | %s |\n' "$ep" "${ep_status[$ep]}" "${ep_http[$ep]}"
  done
  printf '\n## Endpoint Details\n\n'
  for ep in "${ENDPOINTS[@]}"; do
    printf '### %s\n\n' "$ep"
    printf '- **Status:** %s\n' "${ep_status[$ep]}"
    printf '- **HTTP:** %s\n' "${ep_http[$ep]}"
    if [[ -n "${ep_body[$ep]:-}" ]]; then
      printf '- **Response (truncated):**\n\n```\n%s\n```\n\n' "${ep_body[$ep]}"
    else
      printf '\n'
    fi
  done
  if [[ -n "$health_body" ]]; then
    printf '## Health Endpoint Body\n\n```json\n%s\n```\n\n' "$health_body"
  fi
} > "$SNAPSHOT_FILE"

printf '\nSnapshot written: %s\n' "$SNAPSHOT_FILE"

# ── exit ─────────────────────────────────────────────────────────────────────

if [[ "$any_abort" -eq 1 ]]; then
  printf '\n[FAIL] Gateway not reachable. Ensure OpenClaw is running at %s\n' "$OPENCLAW_BASE" >&2
  exit 2
fi

if [[ "$any_missing" -eq 1 ]]; then
  printf '\n[FAIL] One or more required endpoints are MISSING.\n' >&2
  printf '       Contribute upstream or refactor the plan before proceeding.\n' >&2
  exit 1
fi

printf '\n[PASS] All required endpoints present.\n'
exit 0
