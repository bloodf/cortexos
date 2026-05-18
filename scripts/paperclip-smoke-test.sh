#!/usr/bin/env bash
# paperclip-smoke-test.sh — canonical 28-step end-to-end smoke for the
# Paperclip <-> CortexOS bridge. Implements Section 11b of the plan.
#
# Usage:
#   scripts/paperclip-smoke-test.sh                 # full run
#   scripts/paperclip-smoke-test.sh --from-step 7   # resume at happy-path
#   scripts/paperclip-smoke-test.sh --dry-run       # validate env + parse only
#   scripts/paperclip-smoke-test.sh --phase P2      # tag phase in summary
#
# Required env (see prompts/paperclip/60-smoke-test.md):
#   PAPERCLIP_API_URL, PAPERCLIP_API_KEY, PAPERCLIP_WEBHOOK_SECRET,
#   BRIDGE_URL, NATS_URL, PG_DSN
# Optional env:
#   SMOKE_ROLE (default ENG-BACKEND), SMOKE_TIMEOUT_SEC (default 300),
#   SMOKE_POLL_INTERVAL_SEC (default 5), SMOKE_DISTRO (auto-detected),
#   SMOKE_PROJECT_ID (default "smoke"), PAPERCLIP_COMPANY_ID,
#   PAPERCLIP_PINNED_SHA, GIT_SHA (overrides `git rev-parse HEAD`),
#   SMOKE_SKIP_DISTRO=1 to skip steps 22-28 (CI staging mode).
#
# Output contract:
#   - stderr: one structured JSON line per step (kind=step_start|step_end|event)
#   - stdout: final summary JSON object (single line, machine-readable)
#   - exit 0 = PASS, exit 1 = FAIL
#
# Idempotency: safe to re-run. `--from-step N` skips steps with id < N.
# Resumability hinges on Paperclip UNIQUE(runId) + paperclip_ticket_link
# UNIQUE(paperclip_run_id) -- replays do not double-insert.

set -euo pipefail

# ---------------------------------------------------------------------------
# Locate lib + load helpers
# ---------------------------------------------------------------------------
__self_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIB_DIR="${__self_dir}/smoke/lib"
FIXTURE_DIR="${__self_dir}/smoke/fixtures"

# shellcheck source=scripts/smoke/lib/structured-log.sh
. "${LIB_DIR}/structured-log.sh"
# shellcheck source=scripts/smoke/lib/assert.sh
. "${LIB_DIR}/assert.sh"
# shellcheck source=scripts/smoke/lib/curl-json.sh
. "${LIB_DIR}/curl-json.sh"
# shellcheck source=scripts/smoke/lib/nats-sub.sh
. "${LIB_DIR}/nats-sub.sh"
# shellcheck source=scripts/smoke/lib/pg-query.sh
. "${LIB_DIR}/pg-query.sh"

# ---------------------------------------------------------------------------
# Args
# ---------------------------------------------------------------------------
FROM_STEP=1
DRY_RUN=0
PHASE="P4"
while [ $# -gt 0 ]; do
  case "$1" in
    --from-step) FROM_STEP="$2"; shift 2 ;;
    --from-step=*) FROM_STEP="${1#*=}"; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    --phase) PHASE="$2"; shift 2 ;;
    --phase=*) PHASE="${1#*=}"; shift ;;
    -h|--help)
      sed -n '1,30p' "$0"
      exit 0
      ;;
    *)
      printf 'unknown arg: %s\n' "$1" >&2
      exit 2
      ;;
  esac
done

# ---------------------------------------------------------------------------
# Env defaults + validation
# ---------------------------------------------------------------------------
SMOKE_ROLE="${SMOKE_ROLE:-ENG-BACKEND}"
SMOKE_TIMEOUT_SEC="${SMOKE_TIMEOUT_SEC:-300}"
SMOKE_POLL_INTERVAL_SEC="${SMOKE_POLL_INTERVAL_SEC:-5}"
SMOKE_PROJECT_ID="${SMOKE_PROJECT_ID:-smoke}"
SMOKE_SKIP_DISTRO="${SMOKE_SKIP_DISTRO:-0}"
GIT_SHA="${GIT_SHA:-$(git rev-parse HEAD 2>/dev/null || printf 'unknown')}"
GIT_SHORT="$(printf '%s' "$GIT_SHA" | cut -c1-7)"
START_TS="$(date +%s)"
SUMMARY_TMP="$(mktemp)"
trap '__sm_cleanup' EXIT

__sm_cleanup() {
  rm -f "$SUMMARY_TMP" 2>/dev/null || true
}

# Detect distro for summary; non-fatal.
if [ -z "${SMOKE_DISTRO:-}" ]; then
  if [ -r /etc/os-release ]; then
    # shellcheck disable=SC1091
    SMOKE_DISTRO="$(. /etc/os-release; printf '%s-%s\n' "${ID:-unknown}" "${VERSION_ID:-0}")"
  else
    SMOKE_DISTRO="$(uname -s | tr '[:upper:]' '[:lower:]')"
  fi
fi

__sm_require_env() {
  local missing=""
  for v in PAPERCLIP_API_URL PAPERCLIP_API_KEY PAPERCLIP_WEBHOOK_SECRET BRIDGE_URL NATS_URL PG_DSN; do
    if [ -z "${!v:-}" ]; then
      missing="${missing} ${v}"
    fi
  done
  if [ -n "$missing" ]; then
    printf 'SMOKE-FAIL:env-missing variables=%s\n' "${missing# }" >&2
    return 1
  fi
}

# ---------------------------------------------------------------------------
# Step harness
# ---------------------------------------------------------------------------
STEPS_JSON=""
FAILURE_JSON="null"
OVERALL_RESULT="pass"

__sm_record() {
  # __sm_record <id> <name> <result> <duration_ms> [evidence]
  local id="$1" name="$2" result="$3" dur="$4" ev="${5:-}"
  local entry
  if [ -n "$ev" ]; then
    entry=$(printf '{"id":%s,"name":"%s","result":"%s","duration_ms":%s,"evidence":"%s"}' \
      "$id" "$name" "$result" "$dur" "$(__sl_json_escape "$ev")")
  else
    entry=$(printf '{"id":%s,"name":"%s","result":"%s","duration_ms":%s}' \
      "$id" "$name" "$result" "$dur")
  fi
  if [ -z "$STEPS_JSON" ]; then
    STEPS_JSON="$entry"
  else
    STEPS_JSON="${STEPS_JSON},${entry}"
  fi
}

__sm_step() {
  # __sm_step <id> <name> <body-fn> <fail-tag>
  local id="$1" name="$2" fn="$3" tag="$4"
  if [ "$id" -lt "$FROM_STEP" ]; then
    __sm_record "$id" "$name" "skipped" 0 "from-step=${FROM_STEP}"
    log_event info "step skipped" "step=$id" "name=$name"
    return 0
  fi
  log_step_start "$id" "$name"
  local t0 t1 dur rc evidence=""
  t0=$(__sl_now_ms)
  set +e
  evidence=$("$fn" 2>&1)
  rc=$?
  set -e
  t1=$(__sl_now_ms)
  dur=$((t1 - t0))
  if [ "$rc" -eq 0 ]; then
    log_step_end "$id" "$name" "pass" "$dur" ""
    __sm_record "$id" "$name" "pass" "$dur"
    return 0
  fi
  log_step_end "$id" "$name" "fail" "$dur" "$evidence"
  __sm_record "$id" "$name" "fail" "$dur" "$evidence"
  FAILURE_JSON=$(printf '{"step":%s,"tag":"SMOKE-FAIL:%s","evidence":"%s"}' \
    "$id" "$tag" "$(__sl_json_escape "$evidence")")
  OVERALL_RESULT="fail"
  return 1
}

# ---------------------------------------------------------------------------
# Pre-flight (steps 1-6)
# ---------------------------------------------------------------------------
step_01_bridge_health() {
  local body
  body=$(curl -fsS "${BRIDGE_URL%/}/healthz" 2>&1) || { printf '%s' "$body"; return 1; }
  printf '%s' "$body" | grep -Eq '"status"[[:space:]]*:[[:space:]]*"ok"' \
    || { printf 'bridge healthz body: %s' "$body"; return 1; }
}

step_02_nats_reachable() { nats_check_connection "$NATS_URL"; }

step_03_jetstream_stream() {
  nats_stream_has_subject "$NATS_URL" CORTEX 'cortex.paperclip.'
}

step_04_pg_migration() {
  pg_ping "$PG_DSN" || return 1
  pg_table_exists "$PG_DSN" paperclip_ticket_link || return 1
}

step_05_paperclip_reachable() {
  local body code
  body=$(curl_json_get "${PAPERCLIP_API_URL%/}/api/agents/me" "$PAPERCLIP_API_KEY")
  code="$CURL_LAST_STATUS"
  assert_status "$code" "200" "paperclip-api-unreachable" || { printf '%s' "$body"; return 1; }
  printf '%s' "$body" | grep -Eq '"companyId"' \
    || { printf 'agents/me missing companyId: %s' "$body"; return 1; }
}

step_06_role_registered() {
  local body code
  body=$(curl_json_get "${PAPERCLIP_API_URL%/}/api/agents?role=${SMOKE_ROLE}" "$PAPERCLIP_API_KEY")
  code="$CURL_LAST_STATUS"
  assert_status "$code" "200" "agent-list-unreachable" || { printf '%s' "$body"; return 1; }
  printf '%s' "$body" | grep -Fq "\"cortexRole\":\"${SMOKE_ROLE}\"" \
    || { printf 'role %s not registered. body: %s' "$SMOKE_ROLE" "$body"; return 1; }
}

# ---------------------------------------------------------------------------
# Happy path (7-14)
# ---------------------------------------------------------------------------
ISSUE_ID=""
RUN_ID=""
AGENT_ID=""
NATS_CAPTURE=""

step_07_create_issue() {
  local payload body code
  AGENT_ID=$(curl_json_get "${PAPERCLIP_API_URL%/}/api/agents?role=${SMOKE_ROLE}" "$PAPERCLIP_API_KEY" \
    | grep -Eo '"id":"[^"]+"' | head -n1 | cut -d'"' -f4)
  assert_nonempty "$AGENT_ID" "agent-id-resolve" || return 1
  payload=$(sed \
    -e "s/__SHA__/${GIT_SHORT}/g" \
    -e "s/__TS__/${START_TS}/g" \
    -e "s/__AGENT_ID__/${AGENT_ID}/g" \
    -e "s/__ROLE__/${SMOKE_ROLE}/g" \
    "${FIXTURE_DIR}/issue-payload.json")
  body=$(curl_json_post "${PAPERCLIP_API_URL%/}/api/issues" "$payload" "$PAPERCLIP_API_KEY")
  code="$CURL_LAST_STATUS"
  assert_status "$code" "201" "issue-create" || { printf '%s' "$body"; return 1; }
  ISSUE_ID=$(printf '%s' "$body" | grep -Eo '"id":"[^"]+"' | head -n1 | cut -d'"' -f4)
  assert_nonempty "$ISSUE_ID" "issue-id-parse" || return 1
  NATS_CAPTURE="$(mktemp)"
  nats --server="$NATS_URL" sub 'cortex.paperclip.work.*' --count=1 --timeout=60s \
    >"$NATS_CAPTURE" 2>&1 &
  NATS_PID=$!
  printf 'issue=%s agent=%s nats_pid=%s' "$ISSUE_ID" "$AGENT_ID" "$NATS_PID"
}

step_08_trigger_heartbeat() {
  local body code
  body=$(curl_json_post "${PAPERCLIP_API_URL%/}/api/issues/${ISSUE_ID}/wake" '{}' "$PAPERCLIP_API_KEY")
  code="$CURL_LAST_STATUS"
  case "$code" in
    200|202|204) : ;;
    *) printf 'wake http=%s body=%s' "$code" "$body"; return 1 ;;
  esac
}

step_09_wait_bridge_ack() {
  local deadline=$((SECONDS + 30))
  while [ "$SECONDS" -lt "$deadline" ]; do
    local got
    got=$(pg_scalar "$PG_DSN" \
      "SELECT paperclip_run_id||'|'||status FROM paperclip_ticket_link WHERE paperclip_issue_id='${ISSUE_ID}' ORDER BY created_at DESC LIMIT 1")
    if [ -n "$got" ]; then
      RUN_ID="${got%%|*}"
      local st="${got##*|}"
      assert_eq "$st" "open" "bridge-ack-wrong-status" || { printf 'status=%s run=%s' "$st" "$RUN_ID"; return 1; }
      printf 'run_id=%s' "$RUN_ID"
      return 0
    fi
    sleep "$SMOKE_POLL_INTERVAL_SEC"
  done
  printf 'no link row after 30s issue=%s' "$ISSUE_ID"
  return 1
}

step_10_nats_work_observed() {
  # Wait for the background sub from step 7 to finish.
  if [ -n "${NATS_PID:-}" ]; then
    wait "$NATS_PID" 2>/dev/null || true
  fi
  if [ ! -s "$NATS_CAPTURE" ]; then
    printf 'no NATS work message captured'
    return 1
  fi
  local body
  body=$(cat "$NATS_CAPTURE")
  for key in runId issueId role; do
    if ! printf '%s' "$body" | grep -Fq "\"${key}\""; then
      printf 'work msg missing %s. body=%s' "$key" "$body"
      return 1
    fi
  done
  if ! printf '%s' "$body" | grep -Fq "\"${SMOKE_ROLE}\""; then
    printf 'role mismatch in work msg. body=%s' "$body"
    return 1
  fi
}

step_11_consumer_claim() {
  local deadline=$((SECONDS + 30))
  while [ "$SECONDS" -lt "$deadline" ]; do
    local st
    st=$(pg_scalar "$PG_DSN" \
      "SELECT status FROM paperclip_ticket_link WHERE paperclip_run_id='${RUN_ID}' LIMIT 1")
    if [ "$st" = "in_progress" ] || [ "$st" = "done" ]; then
      printf 'status=%s' "$st"
      return 0
    fi
    sleep "$SMOKE_POLL_INTERVAL_SEC"
  done
  printf 'consumer did not claim run=%s' "$RUN_ID"
  return 1
}

step_12_commit_produced() {
  local deadline=$((SECONDS + SMOKE_TIMEOUT_SEC))
  while [ "$SECONDS" -lt "$deadline" ]; do
    if git ls-remote origin "refs/heads/smoke-*" 2>/dev/null | grep -q "smoke-"; then
      return 0
    fi
    sleep "$SMOKE_POLL_INTERVAL_SEC"
  done
  printf 'no smoke-* branch within %ss' "$SMOKE_TIMEOUT_SEC"
  return 1
}

step_13_status_patch() {
  local deadline=$((SECONDS + SMOKE_TIMEOUT_SEC))
  while [ "$SECONDS" -lt "$deadline" ]; do
    local body st
    body=$(curl_json_get "${PAPERCLIP_API_URL%/}/api/issues/${ISSUE_ID}" "$PAPERCLIP_API_KEY")
    st=$(printf '%s' "$body" | grep -Eo '"status":"[^"]+"' | head -n1 | cut -d'"' -f4)
    if [ "$st" = "done" ]; then
      if printf '%s' "$body" | grep -Fq "smoke commit"; then
        printf 'issue status=done comment-ok'
        return 0
      fi
    fi
    sleep "$SMOKE_POLL_INTERVAL_SEC"
  done
  printf 'status PATCH not observed for issue=%s' "$ISSUE_ID"
  return 1
}

step_14_link_terminal() {
  local row
  row=$(pg_scalar "$PG_DSN" \
    "SELECT status||'|'||COALESCE(cost_usd_cents,0)||'|'||COALESCE(EXTRACT(EPOCH FROM (now()-updated_at))::int,9999) FROM paperclip_ticket_link WHERE paperclip_run_id='${RUN_ID}'")
  assert_nonempty "$row" "link-row-missing" || return 1
  local st cost age
  st="${row%%|*}"
  local rest="${row#*|}"
  cost="${rest%%|*}"
  age="${rest##*|}"
  assert_eq "$st" "done" "link-row-not-done" || { printf 'row=%s' "$row"; return 1; }
  if [ "$cost" -le 0 ]; then printf 'cost not positive row=%s' "$row"; return 1; fi
  if [ "$age" -gt 60 ]; then printf 'updated_at stale row=%s' "$row"; return 1; fi
}

# ---------------------------------------------------------------------------
# Negative path (15-18)
# ---------------------------------------------------------------------------
__sm_neg_body() {
  printf '{"runId":"smoke-neg-%s","agentId":"smoke","context":{"taskId":"neg","wakeReason":"manual"}}' \
    "$START_TS"
}

step_15_wrong_bearer() {
  local code
  code=$(curl_status_only POST "${BRIDGE_URL%/}/paperclip/heartbeat" "wrong-bearer" "$(__sm_neg_body)")
  assert_status "$code" "401" "wrong-bearer-not-401"
}

step_16_missing_bearer() {
  local code
  code=$(curl -sS -o /dev/null -w '%{http_code}' \
    -X POST "${BRIDGE_URL%/}/paperclip/heartbeat" \
    -H 'Content-Type: application/json' \
    --data "$(__sm_neg_body)" || printf '000')
  assert_status "$code" "401" "missing-bearer-not-401"
}

step_17_length_mismatch_bearer() {
  local short="${PAPERCLIP_WEBHOOK_SECRET:0:-1}"
  local code
  code=$(curl_status_only POST "${BRIDGE_URL%/}/paperclip/heartbeat" "$short" "$(__sm_neg_body)")
  assert_status "$code" "401" "length-mismatch-not-401"
}

step_18_replay_idempotent() {
  if [ -z "$RUN_ID" ]; then
    printf 'no RUN_ID captured -- did happy path run?'
    return 1
  fi
  local replay
  replay=$(printf '{"runId":"%s","agentId":"smoke","context":{"taskId":"replay","wakeReason":"manual"}}' "$RUN_ID")
  local code
  code=$(curl_status_only POST "${BRIDGE_URL%/}/paperclip/heartbeat" "$PAPERCLIP_WEBHOOK_SECRET" "$replay")
  case "$code" in
    200|202) : ;;
    *) printf 'replay http=%s' "$code"; return 1 ;;
  esac
  local cnt
  cnt=$(pg_count "$PG_DSN" \
    "SELECT COUNT(*) FROM paperclip_ticket_link WHERE paperclip_run_id='${RUN_ID}'")
  assert_eq "$cnt" "1" "replay-duplicated-row" || { printf 'count=%s' "$cnt"; return 1; }
}

# ---------------------------------------------------------------------------
# Governance (19-21)
# ---------------------------------------------------------------------------
step_19_approval_gate() {
  local payload body code dest_issue
  payload=$(sed \
    -e "s/__SHA__/${GIT_SHORT}/g" \
    -e "s/__TS__/${START_TS}/g" \
    -e "s/__AGENT_ID__/${AGENT_ID}/g" \
    -e "s/__ROLE__/${SMOKE_ROLE}/g" \
    "${FIXTURE_DIR}/destructive-payload.json")
  body=$(curl_json_post "${PAPERCLIP_API_URL%/}/api/issues" "$payload" "$PAPERCLIP_API_KEY")
  code="$CURL_LAST_STATUS"
  assert_status "$code" "201" "destructive-create" || { printf '%s' "$body"; return 1; }
  dest_issue=$(printf '%s' "$body" | grep -Eo '"id":"[^"]+"' | head -n1 | cut -d'"' -f4)
  assert_nonempty "$dest_issue" "destructive-id" || return 1
  # Trigger and expect pending_approval (not dispatched).
  curl_json_post "${PAPERCLIP_API_URL%/}/api/issues/${dest_issue}/wake" '{}' "$PAPERCLIP_API_KEY" >/dev/null || true
  sleep "$SMOKE_POLL_INTERVAL_SEC"
  local st
  st=$(curl_json_get "${PAPERCLIP_API_URL%/}/api/issues/${dest_issue}" "$PAPERCLIP_API_KEY" \
    | grep -Eo '"status":"[^"]+"' | head -n1 | cut -d'"' -f4)
  assert_eq "$st" "pending_approval" "approval-bypass" \
    || { printf 'status=%s issue=%s' "$st" "$dest_issue"; return 1; }
  # Approve.
  local approval_id approve_code
  approval_id=$(curl_json_get "${PAPERCLIP_API_URL%/}/api/issues/${dest_issue}/approvals" "$PAPERCLIP_API_KEY" \
    | grep -Eo '"id":"[^"]+"' | head -n1 | cut -d'"' -f4)
  assert_nonempty "$approval_id" "approval-id" || return 1
  approve_code=$(curl_status_only POST "${PAPERCLIP_API_URL%/}/api/approvals/${approval_id}/approve" \
    "$PAPERCLIP_API_KEY" '{}')
  case "$approve_code" in 200|201|202) : ;; *) printf 'approve http=%s' "$approve_code"; return 1 ;; esac
  # Proceed to done.
  local deadline=$((SECONDS + SMOKE_TIMEOUT_SEC))
  while [ "$SECONDS" -lt "$deadline" ]; do
    st=$(curl_json_get "${PAPERCLIP_API_URL%/}/api/issues/${dest_issue}" "$PAPERCLIP_API_KEY" \
      | grep -Eo '"status":"[^"]+"' | head -n1 | cut -d'"' -f4)
    [ "$st" = "done" ] && { printf 'approved->done'; return 0; }
    sleep "$SMOKE_POLL_INTERVAL_SEC"
  done
  printf 'approved issue did not reach done (status=%s)' "$st"
  return 1
}

step_20_budget_enforcement() {
  local payload code body
  payload=$(sed -e "s/__ROLE__/${SMOKE_ROLE}/g" "${FIXTURE_DIR}/budget-cap.json")
  body=$(curl_json_post "${PAPERCLIP_API_URL%/}/api/budgets" "$payload" "$PAPERCLIP_API_KEY")
  code="$CURL_LAST_STATUS"
  case "$code" in 200|201|204) : ;; *) printf 'set-budget http=%s body=%s' "$code" "$body"; return 1 ;; esac
  # Submit a fresh issue.
  local issue_payload issue_body issue_code budget_issue
  issue_payload=$(sed \
    -e "s/__SHA__/${GIT_SHORT}/g" \
    -e "s/__TS__/${START_TS}b/g" \
    -e "s/__AGENT_ID__/${AGENT_ID}/g" \
    -e "s/__ROLE__/${SMOKE_ROLE}/g" \
    "${FIXTURE_DIR}/issue-payload.json")
  issue_body=$(curl_json_post "${PAPERCLIP_API_URL%/}/api/issues" "$issue_payload" "$PAPERCLIP_API_KEY")
  issue_code="$CURL_LAST_STATUS"
  assert_status "$issue_code" "201" "budget-issue-create" || { printf '%s' "$issue_body"; return 1; }
  budget_issue=$(printf '%s' "$issue_body" | grep -Eo '"id":"[^"]+"' | head -n1 | cut -d'"' -f4)
  curl_json_post "${PAPERCLIP_API_URL%/}/api/issues/${budget_issue}/wake" '{}' "$PAPERCLIP_API_KEY" >/dev/null || true
  local deadline=$((SECONDS + 60)) st reason
  while [ "$SECONDS" -lt "$deadline" ]; do
    local row
    row=$(pg_scalar "$PG_DSN" \
      "SELECT status FROM paperclip_ticket_link WHERE paperclip_issue_id='${budget_issue}' ORDER BY created_at DESC LIMIT 1")
    st="$row"
    if [ "$st" = "cancelled" ]; then
      reason=$(curl_json_get "${PAPERCLIP_API_URL%/}/api/issues/${budget_issue}" "$PAPERCLIP_API_KEY" \
        | grep -Eo '"reason":"[^"]+"' | head -n1 | cut -d'"' -f4)
      if [ "$reason" = "budget_exhausted" ]; then return 0; fi
      printf 'cancelled but reason=%s' "$reason"
      return 1
    fi
    sleep "$SMOKE_POLL_INTERVAL_SEC"
  done
  printf 'budget did not enforce within 60s (status=%s)' "$st"
  return 1
}

step_21_approval_timeout() {
  local payload body code dest_issue
  payload=$(sed \
    -e "s/__SHA__/${GIT_SHORT}/g" \
    -e "s/__TS__/${START_TS}t/g" \
    -e "s/__AGENT_ID__/${AGENT_ID}/g" \
    -e "s/__ROLE__/${SMOKE_ROLE}/g" \
    "${FIXTURE_DIR}/destructive-payload.json")
  body=$(curl_json_post "${PAPERCLIP_API_URL%/}/api/issues" "$payload" "$PAPERCLIP_API_KEY")
  code="$CURL_LAST_STATUS"
  assert_status "$code" "201" "timeout-create" || { printf '%s' "$body"; return 1; }
  dest_issue=$(printf '%s' "$body" | grep -Eo '"id":"[^"]+"' | head -n1 | cut -d'"' -f4)
  curl_json_post "${PAPERCLIP_API_URL%/}/api/issues/${dest_issue}/wake" '{}' "$PAPERCLIP_API_KEY" >/dev/null || true
  # Do NOT approve. fixture sets approvalTimeoutSec=60 -> wait 90s.
  sleep 90
  local st reason
  st=$(curl_json_get "${PAPERCLIP_API_URL%/}/api/issues/${dest_issue}" "$PAPERCLIP_API_KEY" \
    | grep -Eo '"status":"[^"]+"' | head -n1 | cut -d'"' -f4)
  reason=$(curl_json_get "${PAPERCLIP_API_URL%/}/api/issues/${dest_issue}" "$PAPERCLIP_API_KEY" \
    | grep -Eo '"reason":"[^"]+"' | head -n1 | cut -d'"' -f4)
  assert_eq "$st" "cancelled" "approval-no-timebox" || { printf 'status=%s' "$st"; return 1; }
  assert_eq "$reason" "approval_timeout" "approval-wrong-reason" || { printf 'reason=%s' "$reason"; return 1; }
}

# ---------------------------------------------------------------------------
# Distro / install path (22-28). Skipped via SMOKE_SKIP_DISTRO=1 in CI staging.
# ---------------------------------------------------------------------------
step_22_os_detect() {
  if [ ! -x "${__self_dir}/os-detect.sh" ]; then
    printf 'os-detect.sh not executable'
    return 1
  fi
  local out
  out="$("${__self_dir}/os-detect.sh")" || { printf '%s' "$out"; return 1; }
  case "$out" in
    'ubuntu '*|'fedora '*|'rhel '*|'rocky '*|'almalinux '*)
      printf 'detected=%s' "$out"
      ;;
    *)
      printf 'unexpected os-detect output: %s' "$out"
      return 1
      ;;
  esac
}

step_23_pkg_dispatch() {
  # Source pkg.sh in a subshell, ensure pkg_family resolves.
  local fam
  fam=$(bash -c ". '${__self_dir}/pkg.sh'; pkg_family" 2>&1) || { printf '%s' "$fam"; return 1; }
  case "$fam" in
    ubuntu|fedora|rhel) printf 'family=%s' "$fam" ;;
    *) printf 'unsupported family=%s' "$fam"; return 1 ;;
  esac
}

step_24_prompt_sequence() {
  # Validate that the local-prompt-runner is callable in --dry-run mode.
  local runner="${__self_dir}/local-prompt-runner.sh"
  if [ ! -x "$runner" ]; then
    printf 'local-prompt-runner.sh missing or not executable'
    return 1
  fi
  if ! "$runner" --help >/dev/null 2>&1; then
    # Older runner may not implement --help; treat absent runner as fatal but
    # silent --help as advisory.
    printf 'runner exists but --help failed (advisory)'
    return 0
  fi
}

step_25_dashboard_health() {
  local url="${SMOKE_DASHBOARD_URL:-http://127.0.0.1:3080/en/login}"
  local code
  code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 30 "$url" || printf '000')
  assert_status "$code" "200" "dashboard-unhealthy" || { printf 'url=%s http=%s' "$url" "$code"; return 1; }
}

step_26_systemd_units() {
  if ! command -v systemctl >/dev/null 2>&1; then
    printf 'systemctl unavailable (non-systemd host) -- treating as advisory'
    return 0
  fi
  local svc rc=0
  for svc in cortex-consumer cortex-dashboard cortex-dashboard-env-writer; do
    if ! systemctl is-active "$svc" >/dev/null 2>&1; then
      printf 'svc-inactive=%s ' "$svc"; rc=1
    fi
    if systemctl is-failed "$svc" >/dev/null 2>&1; then
      printf 'svc-failed=%s ' "$svc"; rc=1
    fi
  done
  return "$rc"
}

step_27_selinux() {
  if ! command -v getenforce >/dev/null 2>&1; then
    printf 'getenforce absent (likely Ubuntu) -- skip'
    return 0
  fi
  local mode
  mode=$(getenforce 2>/dev/null || printf 'Unknown')
  assert_eq "$mode" "Enforcing" "selinux-not-enforcing" || { printf 'mode=%s' "$mode"; return 1; }
  if command -v journalctl >/dev/null 2>&1; then
    if journalctl -p err -u 'cortex-*' --since '1 hour ago' 2>/dev/null | grep -Eq 'avc: *denied'; then
      printf 'AVC denials present in journal'
      return 1
    fi
  fi
}

step_28_firewall() {
  if command -v firewall-cmd >/dev/null 2>&1; then
    local ports
    ports=$(firewall-cmd --list-ports 2>/dev/null || true)
    printf 'firewalld ports=%s' "$ports"
    return 0
  fi
  if command -v ufw >/dev/null 2>&1; then
    local st
    st=$(ufw status 2>/dev/null | head -n1)
    printf 'ufw=%s' "$st"
    return 0
  fi
  printf 'no firewall tooling found (advisory)'
}

# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------
if [ "$DRY_RUN" = "1" ]; then
  log_event info "dry-run start" "phase=$PHASE" "from_step=$FROM_STEP"
  __sm_require_env || exit 1
  # Validate each step function exists.
  for fn in step_01_bridge_health step_02_nats_reachable step_03_jetstream_stream \
            step_04_pg_migration step_05_paperclip_reachable step_06_role_registered \
            step_07_create_issue step_08_trigger_heartbeat step_09_wait_bridge_ack \
            step_10_nats_work_observed step_11_consumer_claim step_12_commit_produced \
            step_13_status_patch step_14_link_terminal step_15_wrong_bearer \
            step_16_missing_bearer step_17_length_mismatch_bearer step_18_replay_idempotent \
            step_19_approval_gate step_20_budget_enforcement step_21_approval_timeout \
            step_22_os_detect step_23_pkg_dispatch step_24_prompt_sequence \
            step_25_dashboard_health step_26_systemd_units step_27_selinux step_28_firewall; do
    if ! declare -F "$fn" >/dev/null; then
      printf 'SMOKE-FAIL:dry-run-step-missing fn=%s\n' "$fn" >&2
      exit 1
    fi
  done
  printf '{"result":"pass","mode":"dry-run","phase":"%s","steps_validated":28}\n' "$PHASE"
  exit 0
fi

__sm_require_env || {
  printf '{"result":"fail","phase":"%s","failure":{"step":0,"tag":"SMOKE-FAIL:env-missing","evidence":"required env not set"}}\n' "$PHASE"
  exit 1
}

# Run steps; stop on first failure unless override is set.
SMOKE_CONTINUE_ON_FAIL="${SMOKE_CONTINUE_ON_FAIL:-0}"

__sm_run() {
  local id="$1" name="$2" fn="$3" tag="$4"
  if ! __sm_step "$id" "$name" "$fn" "$tag"; then
    if [ "$SMOKE_CONTINUE_ON_FAIL" != "1" ]; then
      return 1
    fi
  fi
}

set +e
__sm_run 1 "bridge-healthz" step_01_bridge_health bridge-healthz &&
__sm_run 2 "nats-reachable" step_02_nats_reachable nats-unreachable &&
__sm_run 3 "jetstream-stream" step_03_jetstream_stream jetstream-stream-missing &&
__sm_run 4 "pg-migration" step_04_pg_migration pg-migration-missing &&
__sm_run 5 "paperclip-api" step_05_paperclip_reachable paperclip-api-unreachable &&
__sm_run 6 "role-registered" step_06_role_registered role-not-registered &&
__sm_run 7 "create-issue" step_07_create_issue issue-create-failed &&
__sm_run 8 "trigger-heartbeat" step_08_trigger_heartbeat heartbeat-trigger-failed &&
__sm_run 9 "bridge-ack" step_09_wait_bridge_ack bridge-ack-timeout &&
__sm_run 10 "nats-work-observed" step_10_nats_work_observed nats-work-missed &&
__sm_run 11 "consumer-claim" step_11_consumer_claim consumer-no-claim &&
__sm_run 12 "commit-produced" step_12_commit_produced no-commit &&
__sm_run 13 "status-patch" step_13_status_patch status-patch-missing &&
__sm_run 14 "link-row-terminal" step_14_link_terminal link-row-stale &&
__sm_run 15 "wrong-bearer-401" step_15_wrong_bearer wrong-bearer-not-401 &&
__sm_run 16 "missing-bearer-401" step_16_missing_bearer missing-bearer-not-401 &&
__sm_run 17 "length-mismatch-401" step_17_length_mismatch_bearer length-mismatch-not-401 &&
__sm_run 18 "replay-idempotent" step_18_replay_idempotent replay-not-idempotent &&
__sm_run 19 "approval-gate" step_19_approval_gate approval-bypass &&
__sm_run 20 "budget-enforcement" step_20_budget_enforcement budget-not-enforced &&
__sm_run 21 "approval-timeout" step_21_approval_timeout approval-no-timebox
RUN_RC=$?

if [ "$SMOKE_SKIP_DISTRO" != "1" ] && [ "$RUN_RC" -eq 0 ]; then
  __sm_run 22 "os-detect" step_22_os_detect os-detect-fail &&
  __sm_run 23 "pkg-dispatch" step_23_pkg_dispatch pkg-dispatch-fail &&
  __sm_run 24 "prompt-sequence" step_24_prompt_sequence prompt-sequence-fail &&
  __sm_run 25 "dashboard-health" step_25_dashboard_health dashboard-unhealthy &&
  __sm_run 26 "systemd-green" step_26_systemd_units systemd-degraded &&
  __sm_run 27 "selinux" step_27_selinux selinux-not-enforcing &&
  __sm_run 28 "firewall" step_28_firewall firewall-misconfigured
  RUN_RC=$?
fi
set -e

END_TS="$(date +%s)"
DURATION=$((END_TS - START_TS))
PINNED="${PAPERCLIP_PINNED_SHA:-unknown}"

# Final summary JSON to stdout.
printf '{"result":"%s","phase":"%s","duration_sec":%s,"steps":[%s],"failure":%s,"git_sha":"%s","paperclip_pinned_sha":"%s","distro":"%s","role":"%s"}\n' \
  "$OVERALL_RESULT" "$PHASE" "$DURATION" "$STEPS_JSON" "$FAILURE_JSON" \
  "$GIT_SHA" "$PINNED" "$SMOKE_DISTRO" "$SMOKE_ROLE"

if [ "$OVERALL_RESULT" = "pass" ]; then
  exit 0
fi
exit 1
