#!/usr/bin/env bash
# structured-log.sh — JSON-per-line step logger to stderr.
#
# Public:
#   log_step_start <step_id> <name>
#   log_step_end   <step_id> <name> <result> <duration_ms> [evidence]
#   log_event      <level> <message> [key=value ...]
#
# Each line is a single compact JSON object printed to stderr. The final
# summary JSON is emitted on stdout by the orchestrator, never by this lib.

set -eu

__sl_now_ms() {
  # Portable millisecond timestamp (date %N is GNU-only).
  if command -v python3 >/dev/null 2>&1; then
    python3 -c 'import time; print(int(time.time()*1000))'
  else
    printf '%s000\n' "$(date +%s)"
  fi
}

__sl_iso() {
  date -u +%Y-%m-%dT%H:%M:%SZ
}

__sl_json_escape() {
  # Minimal escape for inclusion in JSON strings.
  printf '%s' "$1" | python3 -c 'import json,sys; sys.stdout.write(json.dumps(sys.stdin.read())[1:-1])' 2>/dev/null \
    || printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e ':a;N;$!ba;s/\n/\\n/g'
}

log_step_start() {
  local id="$1" name="$2"
  printf '{"ts":"%s","kind":"step_start","step":%s,"name":"%s"}\n' \
    "$(__sl_iso)" "$id" "$(__sl_json_escape "$name")" >&2
}

log_step_end() {
  local id="$1" name="$2" result="$3" duration_ms="$4" evidence="${5:-}"
  if [ -n "$evidence" ]; then
    printf '{"ts":"%s","kind":"step_end","step":%s,"name":"%s","result":"%s","duration_ms":%s,"evidence":"%s"}\n' \
      "$(__sl_iso)" "$id" "$(__sl_json_escape "$name")" "$result" "$duration_ms" \
      "$(__sl_json_escape "$evidence")" >&2
  else
    printf '{"ts":"%s","kind":"step_end","step":%s,"name":"%s","result":"%s","duration_ms":%s}\n' \
      "$(__sl_iso)" "$id" "$(__sl_json_escape "$name")" "$result" "$duration_ms" >&2
  fi
}

log_event() {
  local level="$1" msg="$2"
  shift 2
  local extras=""
  while [ $# -gt 0 ]; do
    case "$1" in
      *=*)
        local k="${1%%=*}" v="${1#*=}"
        extras="${extras},\"$(__sl_json_escape "$k")\":\"$(__sl_json_escape "$v")\""
        ;;
    esac
    shift
  done
  printf '{"ts":"%s","kind":"event","level":"%s","message":"%s"%s}\n' \
    "$(__sl_iso)" "$level" "$(__sl_json_escape "$msg")" "$extras" >&2
}

# Expose helpers needed by the orchestrator.
export -f __sl_now_ms __sl_iso __sl_json_escape log_step_start log_step_end log_event
