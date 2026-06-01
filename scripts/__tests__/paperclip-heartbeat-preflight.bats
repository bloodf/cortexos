#!/usr/bin/env bats
# Tests for scripts/paperclip-heartbeat-preflight.py — exit-code contract.
#
# GUN-191 / GUN-192: ensure the heartbeat preflight catches unreachable
# paperclipApiUrl with a distinct exit code (78) instead of letting hermes
# crash later with the generic process_lost recovery.
#
# Run:  bats scripts/__tests__/paperclip-heartbeat-preflight.bats

setup() {
  SCRIPT="${BATS_TEST_DIRNAME}/../paperclip-heartbeat-preflight.py"
  [ -f "$SCRIPT" ]
}

# Use a port that is extremely unlikely to be bound on the test host. 59999
# is in the dynamic range and not used by the runtime.
UNREACHABLE_BASE="http://127.0.0.1:59999/api"

@test "exit 77 when prompt is not a Paperclip heartbeat" {
  run bash -c "echo 'hello' | PAPERCLIP_API_KEY=x python3 '$SCRIPT'"
  [ "$status" -eq 77 ]
}

@test "exit 77 when the identity block is incomplete" {
  run bash -c "printf 'Agent ID: 06156af6-c717-462e-bc56-ed7d2a688393\nNo company line here\n' | PAPERCLIP_API_KEY=x python3 '$SCRIPT'"
  [ "$status" -eq 77 ]
}

@test "exit 79 when PAPERCLIP_API_KEY is missing" {
  PROMPT=$'Agent ID: 06156af6-c717-462e-bc56-ed7d2a688393\nCompany ID: a24e39b2-2ede-4aec-9471-248458a381fc\nAPI Base: '"$UNREACHABLE_BASE"
  run bash -c "printf '%s' \"$PROMPT\" | env -u PAPERCLIP_API_KEY python3 '$SCRIPT'"
  [ "$status" -eq 79 ]
}

@test "exit 78 when API Base is unreachable" {
  PROMPT=$'Agent ID: 06156af6-c717-462e-bc56-ed7d2a688393\nCompany ID: a24e39b2-2ede-4aec-9471-248458a381fc\nAPI Base: '"$UNREACHABLE_BASE"
  run bash -c "printf '%s' \"$PROMPT\" | PAPERCLIP_API_KEY=dummy python3 '$SCRIPT'"
  [ "$status" -eq 78 ]
  # Must emit the structured event on stderr so the launcher / journal pick it up.
  [[ "$output" == *"agent_paperclip_url_unreachable"* ]]
}
