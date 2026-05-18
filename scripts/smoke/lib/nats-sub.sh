#!/usr/bin/env bash
# nats-sub.sh — wrappers around the `nats` CLI for the smoke harness.
#
# Public:
#   nats_check_connection <url>
#   nats_stream_has_subject <url> <stream> <subject_pattern>
#   nats_capture_one <url> <subject_pattern> <timeout_sec> <out_file>
#
# All functions return non-zero on failure with a SMOKE-FAIL:<tag> on stderr.

set -eu

nats_check_connection() {
  local url="$1"
  if ! command -v nats >/dev/null 2>&1; then
    printf 'SMOKE-FAIL:nats-cli-missing\n' >&2
    return 1
  fi
  if ! nats --server="$url" server check connection >/dev/null 2>&1; then
    printf 'SMOKE-FAIL:nats-unreachable url=%s\n' "$url" >&2
    return 1
  fi
}

nats_stream_has_subject() {
  local url="$1" stream="$2" pattern="$3"
  local info
  if ! info=$(nats --server="$url" stream info "$stream" 2>&1); then
    printf 'SMOKE-FAIL:nats-stream-missing stream=%s\n' "$stream" >&2
    return 1
  fi
  if ! printf '%s' "$info" | grep -Fq "$pattern"; then
    printf 'SMOKE-FAIL:nats-stream-subject-missing stream=%s pattern=%s\n' "$stream" "$pattern" >&2
    return 1
  fi
}

nats_capture_one() {
  local url="$1" pattern="$2" timeout="$3" out="$4"
  if ! nats --server="$url" sub "$pattern" --count=1 --timeout="${timeout}s" >"$out" 2>&1; then
    printf 'SMOKE-FAIL:nats-capture-timeout pattern=%s timeout=%s\n' "$pattern" "$timeout" >&2
    return 1
  fi
}

export -f nats_check_connection nats_stream_has_subject nats_capture_one
