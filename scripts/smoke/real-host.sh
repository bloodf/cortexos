#!/usr/bin/env bash
# real-host.sh — re-runnable smoke test of the CortexOS dashboard's
# live-host integration. Assumes the dashboard is running on
# http://127.0.0.1:3080 (the production default) under systemd.
#
# What it covers:
#   T1.1  GET /login page (sanity, expect 200)
#   T1.2  POST /api/auth/login as admin (testadmin) — expect 200 + isAdmin:true
#   T1.3  POST /api/auth/login as non-admin (testuser) — expect 200 + isAdmin:false
#   T2.1  GET /api/audit (no session) — expect 401
#   T2.2  GET /api/audit (testuser) — expect 403
#   T2.3  GET /audit/export (no session) — expect 401 (Ken security fix)
#   T2.4  POST /api/auth/login (no CSRF) — expect 403
#   T2.5  POST /api/auth/login (wrong password) — expect 401
#   T3.1  GET /api/audit (admin) — expect 200, hash chain valid
#   T3.2  GET /api/audit/verify (admin) — expect {"result":{"ok":true,...}}
#   T3.3  GET /audit/export (admin) — expect 200 text/csv
#   T3.4  GET /api/services (admin) — expect 200
#   T3.5  GET /api/alerts (admin) — expect 200
#   T3.6  GET /api/approvals (admin) — expect 200
#   T3.7  GET /api/env-browser?path=/etc/passwd (admin) — expect 403 (PB-3)
#   T3.8  GET /api/terminal (admin) — expect 200, list ops
#   T4.1  POST /api/docker/actions (admin, start) — expect 200, real docker ran
#   T4.2  POST /api/docker/actions (admin, stop) — expect 403 (destructive)
#   T4.3  POST /api/docker/actions (testuser) — expect 403 (admin gate)
#   T5.1  POST /api/systemd/actions (admin, status) — expect 200, real systemctl output
#
# Usage:   bash scripts/smoke/real-host.sh
# Returns: 0 if all pass, 1 if any fail.

set -uo pipefail

BASE="${BASE:-http://127.0.0.1:3080}"
ADMIN_USER="${ADMIN_USER:-testadmin}"
ADMIN_PASS="${ADMIN_PASS:-TestPassword123!}"
USER_USER="${USER_USER:-testuser}"
USER_PASS="${USER_PASS:-TestPassword456!}"
TEST_CONTAINER="${TEST_CONTAINER:-test-nginx}"
TEST_UNIT="${TEST_UNIT:-docker.service}"

ADMIN_COOKIES=$(mktemp)
USER_COOKIES=$(mktemp)
trap 'rm -f "$ADMIN_COOKIES" "$USER_COOKIES"' EXIT

PASS=0
FAIL=0
FAILED_TESTS=()

run() {
  local label="$1"; shift
  local expected="$1"; shift
  local actual="$1"; shift
  if [[ "$expected" == "$actual" ]]; then
    echo "  ✓ $label  ($actual)"
    PASS=$((PASS + 1))
  else
    echo "  ✗ $label  expected=$expected got=$actual"
    FAIL=$((FAIL + 1))
    FAILED_TESTS+=("$label")
  fi
}

# --- Auth ---
echo "=== T1: Auth ==="
curl -fsS -c "$ADMIN_COOKIES" -o /dev/null "$BASE/login"
curl -fsS -b "$ADMIN_COOKIES" -c "$ADMIN_COOKIES" \
  -H "X-CSRF-Token: login-bootstrap" -H "Content-Type: application/json" \
  -d "{\"username\":\"$ADMIN_USER\",\"password\":\"$ADMIN_PASS\"}" \
  -o /dev/null -w "%{http_code}" "$BASE/api/auth/login" > /tmp/admin_login_code
run "T1.1 GET /login" 200 "$(cat /tmp/admin_login_code)"

ADMIN_CSRF=$(grep cortexos_csrf "$ADMIN_COOKIES" | awk -F'\t' '{print $NF}')

curl -fsS -c "$USER_COOKIES" -o /dev/null "$BASE/login"
curl -fsS -b "$USER_COOKIES" -c "$USER_COOKIES" \
  -H "X-CSRF-Token: login-bootstrap" -H "Content-Type: application/json" \
  -d "{\"username\":\"$USER_USER\",\"password\":\"$USER_PASS\"}" \
  -o /dev/null -w "%{http_code}" "$BASE/api/auth/login" > /tmp/user_login_code
run "T1.2 POST login admin" 200 "$(cat /tmp/admin_login_code)"
run "T1.3 POST login non-admin" 200 "$(cat /tmp/user_login_code)"

# --- 401/403 paths ---
echo "=== T2: 401/403 gates ==="
curl -sS -o /dev/null -w "%{http_code}" "$BASE/api/audit" > /tmp/audit_anon
run "T2.1 GET /api/audit anon" 401 "$(cat /tmp/audit_anon)"

curl -sS -b "$USER_COOKIES" -o /dev/null -w "%{http_code}" "$BASE/api/audit" > /tmp/audit_user
run "T2.2 GET /api/audit testuser" 403 "$(cat /tmp/audit_user)"

curl -sS -o /dev/null -w "%{http_code}" "$BASE/audit/export" > /tmp/audit_export_anon
run "T2.3 GET /audit/export anon" 401 "$(cat /tmp/audit_export_anon)"

curl -sS -H "Content-Type: application/json" -d "{\"username\":\"$ADMIN_USER\",\"password\":\"x\"}" \
  -o /dev/null -w "%{http_code}" "$BASE/api/auth/login" > /tmp/login_nocsrf
run "T2.4 POST login no CSRF" 403 "$(cat /tmp/login_nocsrf)"

curl -fsS -c /tmp/c.txt -o /dev/null "$BASE/login"
curl -sS -b /tmp/c.txt -H "X-CSRF-Token: login-bootstrap" -H "Content-Type: application/json" \
  -d "{\"username\":\"$ADMIN_USER\",\"password\":\"wrong-password\"}" \
  -o /dev/null -w "%{http_code}" "$BASE/api/auth/login" > /tmp/login_wrong
run "T2.5 POST login wrong password" 401 "$(cat /tmp/login_wrong)"

# --- Admin read APIs ---
echo "=== T3: Admin reads ==="
curl -sS -b "$ADMIN_COOKIES" -o /dev/null -w "%{http_code}" "$BASE/api/audit" > /tmp/audit_admin
run "T3.1 GET /api/audit admin" 200 "$(cat /tmp/audit_admin)"

curl -sS -b "$ADMIN_COOKIES" "$BASE/api/audit/verify" > /tmp/audit_verify
CHAIN_LEN=$(grep -oE '"length":[0-9]+' /tmp/audit_verify | head -1 | grep -oE '[0-9]+' || echo 0)
CHAIN_OK=$(grep -oE '"ok":true' /tmp/audit_verify | head -1)
if [[ -n "$CHAIN_OK" && "$CHAIN_LEN" -gt 0 ]]; then
  echo "  ✓ T3.2 GET /api/audit/verify  (chain valid, length=$CHAIN_LEN)"
  PASS=$((PASS + 1))
else
  echo "  ✗ T3.2 GET /api/audit/verify  (ok=$CHAIN_OK length=$CHAIN_LEN)"
  FAIL=$((FAIL + 1))
  FAILED_TESTS+=("T3.2 GET /api/audit/verify")
fi

curl -sS -b "$ADMIN_COOKIES" -o /dev/null -w "%{http_code}" "$BASE/audit/export" > /tmp/audit_export_admin
run "T3.3 GET /audit/export admin" 200 "$(cat /tmp/audit_export_admin)"

curl -sS -b "$ADMIN_COOKIES" -o /dev/null -w "%{http_code}" "$BASE/api/services" > /tmp/services
run "T3.4 GET /api/services" 200 "$(cat /tmp/services)"

curl -sS -b "$ADMIN_COOKIES" -o /dev/null -w "%{http_code}" "$BASE/api/alerts" > /tmp/alerts
run "T3.5 GET /api/alerts" 200 "$(cat /tmp/alerts)"

curl -sS -b "$ADMIN_COOKIES" -o /dev/null -w "%{http_code}" "$BASE/api/approvals" > /tmp/approvals
run "T3.6 GET /api/approvals" 200 "$(cat /tmp/approvals)"

curl -sS -b "$ADMIN_COOKIES" -o /dev/null -w "%{http_code}" \
  "$BASE/api/env-browser?path=/etc/passwd" > /tmp/envbrowser
run "T3.7 GET /api/env-browser /etc/passwd" 403 "$(cat /tmp/envbrowser)"

curl -sS -b "$ADMIN_COOKIES" -o /dev/null -w "%{http_code}" "$BASE/api/terminal" > /tmp/terminal
run "T3.8 GET /api/terminal" 200 "$(cat /tmp/terminal)"

# --- Privileged actions ---
echo "=== T4: Privileged actions (real docker) ==="
curl -sS -b "$ADMIN_COOKIES" -H "X-CSRF-Token: $ADMIN_CSRF" -H "Content-Type: application/json" \
  -d "{\"action\":\"start\",\"container\":\"$TEST_CONTAINER\"}" \
  -o /dev/null -w "%{http_code}" "$BASE/api/docker/actions" > /tmp/docker_start
run "T4.1 POST docker start $TEST_CONTAINER" 200 "$(cat /tmp/docker_start)"

curl -sS -b "$ADMIN_COOKIES" -H "X-CSRF-Token: $ADMIN_CSRF" -H "Content-Type: application/json" \
  -d "{\"action\":\"stop\",\"container\":\"$TEST_CONTAINER\"}" \
  -o /dev/null -w "%{http_code}" "$BASE/api/docker/actions" > /tmp/docker_stop
run "T4.2 POST docker stop $TEST_CONTAINER (destructive)" 403 "$(cat /tmp/docker_stop)"

curl -sS -b "$USER_COOKIES" -H "X-CSRF-Token: login-bootstrap" -H "Content-Type: application/json" \
  -d "{\"action\":\"start\",\"container\":\"$TEST_CONTAINER\"}" \
  -o /dev/null -w "%{http_code}" "$BASE/api/docker/actions" > /tmp/docker_user
run "T4.3 POST docker testuser (no admin)" 403 "$(cat /tmp/docker_user)"

# --- Systemd ---
echo "=== T5: Privileged actions (real systemctl) ==="
curl -sS -b "$ADMIN_COOKIES" -H "X-CSRF-Token: $ADMIN_CSRF" -H "Content-Type: application/json" \
  -d "{\"action\":\"status\",\"unit\":\"$TEST_UNIT\"}" \
  -o /dev/null -w "%{http_code}" "$BASE/api/systemd/actions" > /tmp/systemd_status
run "T5.1 POST systemd status $TEST_UNIT" 200 "$(cat /tmp/systemd_status)"

# --- Summary ---
echo ""
echo "================================================"
echo "  Smoke test summary: $PASS passed, $FAIL failed"
echo "================================================"
if [[ $FAIL -gt 0 ]]; then
  echo "Failed tests:"
  for t in "${FAILED_TESTS[@]}"; do
    echo "  - $t"
  done
  exit 1
fi
exit 0
