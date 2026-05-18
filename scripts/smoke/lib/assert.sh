#!/usr/bin/env bash
# assert.sh — minimal assertion helpers for the Paperclip smoke.
#
# Public:
#   assert_eq <actual> <expected> <message>
#   assert_ne <actual> <not_expected> <message>
#   assert_match <string> <regex> <message>
#   assert_status <code> <expected> <message>
#   assert_nonempty <value> <message>
#
# On failure, prints SMOKE-FAIL:<tag> to stderr and returns 1; caller decides
# whether to exit. The orchestrator translates this into the JSON summary.

set -eu

assert_eq() {
  local actual="$1" expected="$2" msg="$3"
  if [ "$actual" != "$expected" ]; then
    printf 'SMOKE-FAIL:%s expected=%q actual=%q\n' "$msg" "$expected" "$actual" >&2
    return 1
  fi
}

assert_ne() {
  local actual="$1" not_expected="$2" msg="$3"
  if [ "$actual" = "$not_expected" ]; then
    printf 'SMOKE-FAIL:%s value=%q must-differ-from=%q\n' "$msg" "$actual" "$not_expected" >&2
    return 1
  fi
}

assert_match() {
  local s="$1" re="$2" msg="$3"
  if ! printf '%s' "$s" | grep -Eq "$re"; then
    printf 'SMOKE-FAIL:%s value=%q regex=%q\n' "$msg" "$s" "$re" >&2
    return 1
  fi
}

assert_status() {
  local code="$1" expected="$2" msg="$3"
  if [ "$code" != "$expected" ]; then
    printf 'SMOKE-FAIL:%s http=%s expected=%s\n' "$msg" "$code" "$expected" >&2
    return 1
  fi
}

assert_nonempty() {
  local v="$1" msg="$2"
  if [ -z "$v" ]; then
    printf 'SMOKE-FAIL:%s value-empty\n' "$msg" >&2
    return 1
  fi
}

export -f assert_eq assert_ne assert_match assert_status assert_nonempty
