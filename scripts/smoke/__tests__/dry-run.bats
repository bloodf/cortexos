#!/usr/bin/env bats
# dry-run.bats — bats-core smoke harness self-check.
#
# Validates: orchestrator parses; every step function is declared; env
# pre-flight fires when variables are missing; --help renders.

setup() {
  ROOT="$(cd "${BATS_TEST_DIRNAME}/../../.." && pwd)"
  SMOKE="${ROOT}/scripts/paperclip-smoke-test.sh"
  export PAPERCLIP_API_URL="https://paperclip.example.test"
  export PAPERCLIP_API_KEY="dummy"
  export PAPERCLIP_WEBHOOK_SECRET="dummy-secret-32bytes-min-aaaaaaaa"
  export BRIDGE_URL="http://127.0.0.1:8089"
  export NATS_URL="nats://127.0.0.1:4222"
  export PG_DSN="postgres://smoke:smoke@127.0.0.1:5432/smoke"
}

@test "smoke script is executable" {
  [ -x "$SMOKE" ]
}

@test "bash parses smoke script" {
  run bash -n "$SMOKE"
  [ "$status" -eq 0 ]
}

@test "lib files parse" {
  for f in assert curl-json nats-sub pg-query structured-log; do
    run bash -n "${ROOT}/scripts/smoke/lib/${f}.sh"
    [ "$status" -eq 0 ]
  done
}

@test "fixture JSONs exist" {
  [ -s "${ROOT}/scripts/smoke/fixtures/issue-payload.json" ]
  [ -s "${ROOT}/scripts/smoke/fixtures/destructive-payload.json" ]
  [ -s "${ROOT}/scripts/smoke/fixtures/budget-cap.json" ]
}

@test "--help prints usage" {
  run "$SMOKE" --help
  [ "$status" -eq 0 ]
  [[ "$output" == *"paperclip-smoke-test.sh"* ]]
}

@test "--dry-run with full env succeeds and validates all 28 steps" {
  run "$SMOKE" --dry-run --phase P4
  [ "$status" -eq 0 ]
  [[ "$output" == *"\"steps_validated\":28"* ]]
}

@test "--dry-run aborts on missing env" {
  unset PAPERCLIP_API_KEY
  run "$SMOKE" --dry-run
  [ "$status" -ne 0 ]
}

@test "--from-step accepts numeric arg without parse error" {
  run bash -c "set -e; '$SMOKE' --dry-run --from-step 7 --phase P4"
  [ "$status" -eq 0 ]
}

@test "fixtures are valid JSON" {
  for f in issue-payload destructive-payload budget-cap; do
    run python3 -c "import json,sys; json.load(open(sys.argv[1]))" \
      "${ROOT}/scripts/smoke/fixtures/${f}.json"
    [ "$status" -eq 0 ]
  done
}
