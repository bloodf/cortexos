#!/usr/bin/env bash
# curl-json.sh — thin curl wrappers that return body + status separately.
#
# Public:
#   curl_json_get  <url> [auth_header]
#   curl_json_post <url> <json_body> [auth_header] [extra_header ...]
#   curl_json_patch <url> <json_body> [auth_header] [extra_header ...]
#   curl_status_only <method> <url> [auth_header] [body]
#
# Output: stdout = body; CURL_LAST_STATUS env var = HTTP code.

set -eu

CURL_LAST_STATUS=""
export CURL_LAST_STATUS

__cj_run() {
  local method="$1" url="$2" body="${3:-}" auth="${4:-}"
  shift 4 || true
  local tmp
  tmp=$(mktemp)
  local -a hdrs=()
  [ -n "$auth" ] && hdrs+=(-H "Authorization: Bearer ${auth}")
  hdrs+=(-H 'Content-Type: application/json')
  while [ $# -gt 0 ]; do
    hdrs+=(-H "$1")
    shift
  done

  local code
  if [ -n "$body" ]; then
    code=$(curl -sS -o "$tmp" -w '%{http_code}' -X "$method" "${hdrs[@]}" --data "$body" "$url" || printf '000')
  else
    code=$(curl -sS -o "$tmp" -w '%{http_code}' -X "$method" "${hdrs[@]}" "$url" || printf '000')
  fi
  CURL_LAST_STATUS="$code"
  cat "$tmp"
  rm -f "$tmp"
}

curl_json_get() {
  __cj_run GET "$1" "" "${2:-}"
}

curl_json_post() {
  local url="$1" body="$2" auth="${3:-}"
  shift 3 || true
  __cj_run POST "$url" "$body" "$auth" "$@"
}

curl_json_patch() {
  local url="$1" body="$2" auth="${3:-}"
  shift 3 || true
  __cj_run PATCH "$url" "$body" "$auth" "$@"
}

curl_status_only() {
  local method="$1" url="$2" auth="${3:-}" body="${4:-}"
  __cj_run "$method" "$url" "$body" "$auth" >/dev/null
  printf '%s\n' "$CURL_LAST_STATUS"
}

export -f curl_json_get curl_json_post curl_json_patch curl_status_only
