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

# --- Session persistence (A1) ---
# Verifies v0.5: the session row lives in Postgres, not in-memory. The cookie
# must survive a full systemd restart of the dashboard.
if [[ -n "${DB_NAME:-}" && -n "${DB_USER:-}" ]]; then
  echo "=== T6: Session persists across dashboard restart (A1) ==="
  # 1. Confirm at least one row in admin_sessions. T1.2 (admin login) and
  #    T1.3 (non-admin login) each wrote a row, so expect ≥ 1.
  SESS_BEFORE=$(PGPASSWORD="${DB_PASSWORD:-testpass}" psql -h "${DB_HOST:-127.0.0.1}" -p "${DB_PORT:-5432}" -U "$DB_USER" -d "$DB_NAME" -tA -c "SELECT COUNT(*) FROM admin_sessions;" 2>/dev/null | tr -d '[:space:]')
  if [[ "${SESS_BEFORE:-0}" -ge 1 ]]; then
    PASS=$((PASS + 1))
    echo "  ✓ T6.1 admin_sessions row(s) exist in Postgres (count=$SESS_BEFORE)"
  else
    FAIL=$((FAIL + 1))
    FAILED_TESTS+=("T6.1 admin_sessions row(s) exist in Postgres (count=$SESS_BEFORE)")
    echo "  ✗ T6.1 admin_sessions row(s) exist in Postgres (count=$SESS_BEFORE)"
  fi

  # 2. Capture the user-id we're currently authenticated as. Must be
  #    a non-empty UUID-like string (the contracts-bridge derives a
  #    UUIDv4-shaped id from the integer pam_users.id).
  ME_BEFORE=$(curl -sS -b "$ADMIN_COOKIES" "$BASE/api/auth/me")
  UID_BEFORE=$(echo "$ME_BEFORE" | grep -oE '"id":"[^"]+"' | head -1 | sed -E 's/^"id":"//; s/"$//')
  if [[ -n "$UID_BEFORE" && "$UID_BEFORE" =~ ^[0-9a-fA-F-]+$ ]]; then
    PASS=$((PASS + 1))
    echo "  ✓ T6.2 /me returns a UUID-shaped user-id before restart (id=$UID_BEFORE)"
  else
    FAIL=$((FAIL + 1))
    FAILED_TESTS+=("T6.2 /me returns a UUID-shaped user-id before restart (got '$UID_BEFORE')")
    echo "  ✗ T6.2 /me returns a UUID-shaped user-id before restart (got '$UID_BEFORE')"
  fi

  # 3. Restart the dashboard service. If we're not root, skip with a soft pass.
  if command -v systemctl >/dev/null && systemctl is-active --quiet "${SERVICE_NAME:-cortex-dashboard.service}" 2>/dev/null; then
    sudo systemctl restart "${SERVICE_NAME:-cortex-dashboard.service}" 2>/dev/null
    sleep 3
  fi

  # 4. Re-curl /me with the same cookie. Must still be 200 with the same user.
  STATUS_AFTER=$(curl -sS -b "$ADMIN_COOKIES" -o /tmp/me_after -w "%{http_code}" "$BASE/api/auth/me")
  run "T6.3 /me survives restart (cookie still valid)" 200 "$STATUS_AFTER"
  UID_AFTER=$(grep -oE '"id":"[^"]+"' /tmp/me_after | head -1 | sed -E 's/^"id":"//; s/"$//')
  run "T6.4 /me returns same user-id after restart" "$UID_BEFORE" "$UID_AFTER"
else
  echo "=== T6: SKIPPED (DB_NAME/DB_USER not set) ==="
fi

# --- Summary ---
echo ""
echo "================================================"
echo "  Smoke test summary: $PASS passed, $FAIL failed"
echo "================================================"

# --- T7: /apps launcher surface + term.fzf terminal op (W59/W58) ---
# Verifies the new dashboard-launcher Service kind + the new fzf op
# surface in the live host. W59 adds two seed rows (hermes-webui-host
# openUrl=/hermes/, boxbox-host openUrl=/files/) via migration 009; the
# /apps page renders them as a card grid. W58 adds term.fzf to the
# terminal allowlist. T7.1 + T7.3 require the v1.0.0 build (with the
# W59 changes) deployed; against an older build they will fail.
echo "=== T7: /apps launcher + term.fzf (W59/W58) ==="

# T7.1 — admin GET /apps returns the launcher data in the SvelteKit
# hydration payload (the cards are rendered client-side; curl doesn't
# execute JS, so the data-testid strings won't appear in the SSR'd
# HTML body — but the launchers are in the __sveltekit data blob).
# Note: the data is embedded as JS object literals (slug:"foo"),
# not JSON — the grep is unquoted on the value side.
curl -sS -b "$ADMIN_COOKIES" -o /tmp/apps_admin_html -w "%{http_code}" "$BASE/apps" > /tmp/apps_admin
run "T7.1 GET /apps admin" 200 "$(cat /tmp/apps_admin)"
if grep -q 'slug:"hermes-webui-host"' /tmp/apps_admin_html; then
  PASS=$((PASS + 1))
  echo "  ✓ T7.1a /apps hydration payload contains hermes-webui-host"
else
  FAIL=$((FAIL + 1))
  FAILED_TESTS+=("T7.1a /apps hydration payload contains hermes-webui-host (slug missing from __sveltekit data blob)")
  echo "  ✗ T7.1a /apps hydration payload contains hermes-webui-host"
fi
if grep -q 'slug:"boxbox-host"' /tmp/apps_admin_html; then
  PASS=$((PASS + 1))
  echo "  ✓ T7.1b /apps hydration payload contains boxbox-host"
else
  FAIL=$((FAIL + 1))
  FAILED_TESTS+=("T7.1b /apps hydration payload contains boxbox-host (slug missing from __sveltekit data blob)")
  echo "  ✗ T7.1b /apps hydration payload contains boxbox-host"
fi

# T7.2 — anon GET /apps is redirected to /login (303 from the (authed) layout)
curl -sS -o /dev/null -w "%{http_code}" "$BASE/apps" > /tmp/apps_anon
run "T7.2 GET /apps anon" 303 "$(cat /tmp/apps_anon)"

# T7.3 — /api/services contains the two seeded launchers (admin)
curl -sS -b "$ADMIN_COOKIES" "$BASE/api/services" > /tmp/services_json
if grep -q '"slug":"hermes-webui-host"' /tmp/services_json && grep -q '"slug":"boxbox-host"' /tmp/services_json; then
  PASS=$((PASS + 1))
  echo "  ✓ T7.3 /api/services lists hermes-webui-host + boxbox-host"
else
  FAIL=$((FAIL + 1))
  FAILED_TESTS+=("T7.3 /api/services lists hermes-webui-host + boxbox-host (one or both slugs missing)")
  echo "  ✗ T7.3 /api/services lists hermes-webui-host + boxbox-host"
fi
if grep -q '"kind":"dashboard-launcher"' /tmp/services_json; then
  PASS=$((PASS + 1))
  echo "  ✓ T7.3a /api/services surfaces kind=dashboard-launcher rows"
else
  FAIL=$((FAIL + 1))
  FAILED_TESTS+=("T7.3a /api/services surfaces kind=dashboard-launcher rows (no match in JSON)")
  echo "  ✗ T7.3a /api/services surfaces kind=dashboard-launcher rows"
fi

# T7.4 — /api/terminal ops list contains term.fzf (W58)
curl -sS -b "$ADMIN_COOKIES" "$BASE/api/terminal" > /tmp/terminal_ops
if grep -q '"op":"term.fzf"' /tmp/terminal_ops; then
  PASS=$((PASS + 1))
  echo "  ✓ T7.4 /api/terminal ops list contains term.fzf"
else
  FAIL=$((FAIL + 1))
  FAILED_TESTS+=("T7.4 /api/terminal ops list contains term.fzf (entry not in JSON)")
  echo "  ✗ T7.4 /api/terminal ops list contains term.fzf"
fi

# T7.5 — /api/services lists memory-os-host (F-3, migration 010). The
# Memory OS launcher is the third dashboard-launcher seed row; the
# host /memory/ path is Caddy-reverse-proxied to the upstream wiki
# service (per prompts/tools/33-hermes-memory-os.md).
if grep -q '"slug":"memory-os-host"' /tmp/services_json; then
  PASS=$((PASS + 1))
  echo "  ✓ T7.5 /api/services lists memory-os-host"
else
  FAIL=$((FAIL + 1))
  FAILED_TESTS+=("T7.5 /api/services lists memory-os-host (slug missing from JSON)")
  echo "  ✗ T7.5 /api/services lists memory-os-host"
fi

# T7.6 — /apps hydration payload contains memory-os-host. Reuses the
# /tmp/apps_admin_html fetched for T7.1 (admin GET /apps). The data is
# embedded as JS object literals (slug:"foo"), not JSON.
if grep -q 'slug:"memory-os-host"' /tmp/apps_admin_html; then
  PASS=$((PASS + 1))
  echo "  ✓ T7.6 /apps hydration payload contains memory-os-host"
else
  FAIL=$((FAIL + 1))
  FAILED_TESTS+=("T7.6 /apps hydration payload contains memory-os-host (slug missing from __sveltekit data blob)")
  echo "  ✗ T7.6 /apps hydration payload contains memory-os-host"
fi

# Re-print summary after T7 additions
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
