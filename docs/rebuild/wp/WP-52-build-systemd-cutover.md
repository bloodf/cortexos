# WP-52 — Build + systemd cutover
- **Wave:** 3   **Depends-on:** WP-50 (green security gate), WP-51 (parity report, zero blockers)   **Parallel-safe-with:** nothing — this is the sequential switch
- **Owns (edit only these):**
  - `templates/systemd/cortex-dashboard.service` (update `ExecStart` + `WorkingDirectory`)
  - `docs/rebuild/DEPLOY.md` (update or create deploy runbook)
- **Do NOT touch:** `packages/dashboard` (legacy build stays intact for rollback); `packages/dashboard-next/` source (no code changes here — build only); any other template or script

## Objective

Build the `dashboard-next` node-server output, repoint the live
`cortex-dashboard.service` systemd unit to it, smoke-test the new app on
`:3080`, and leave the legacy `packages/dashboard/build/` intact for an instant
rollback. After this WP, the live dashboard is served by `dashboard-next`.

**Prerequisites (check before starting):**
1. `STATUS.md` shows `WP-50 done`.
2. `STATUS.md` shows `WP-51 done` with `0 blockers`.
3. `packages/dashboard/build/index.js` exists and is the currently-running legacy build (do not delete it).

## Read first

| File | Why |
|------|-----|
| `templates/systemd/cortex-dashboard.service` | Template to update — current `ExecStart` and `WorkingDirectory` |
| `/etc/systemd/system/cortex-dashboard.service` | Live rendered unit — compare before/after |
| `packages/dashboard/AGENTS.md` | Legacy build commands and deploy steps (reference, do not edit file) |
| `docs/rebuild/00-OVERVIEW.md` §Runtime | Node-server preset, EnvironmentFile path |
| `docs/rebuild/02-CONVENTIONS.md` §Directory layout | `packages/dashboard-next/` output path |

## Current state of the systemd template

```ini
# templates/systemd/cortex-dashboard.service (before this WP)
[Service]
WorkingDirectory={CORTEX_ROOT}/packages/dashboard
ExecStart=/usr/bin/node build/index.js
EnvironmentFile={CORTEX_SECRETS_DIR}/dashboard.env
```

The rendered live unit (`/etc/systemd/system/cortex-dashboard.service`) has:
```ini
WorkingDirectory=/opt/cortexos/packages/dashboard
ExecStart=/usr/bin/node build/index.js
EnvironmentFile=/opt/cortexos/.secrets/dashboard.env
```

## Target state

```ini
# After this WP — template
[Service]
WorkingDirectory={CORTEX_ROOT}/packages/dashboard-next
ExecStart=/usr/bin/node .output/server/index.mjs
EnvironmentFile={CORTEX_SECRETS_DIR}/dashboard.env
```

> **Node-server output path:** TanStack Start with Nitro `node-server` preset emits
> `.output/server/index.mjs` inside the package directory. Verify the exact entry
> path after build by running `ls packages/dashboard-next/.output/server/` — adjust
> `ExecStart` if Nitro emits a different filename (e.g. `index.js`).

The `ReadWritePaths` line must be updated to include the new working directory:
```ini
ReadWritePaths={CORTEX_ROOT}/packages/dashboard-next {CORTEX_ROOT}/logs /run/cortexos
```

All other hardening directives (`NoNewPrivileges`, `ProtectSystem`, `CapabilityBoundingSet`, etc.) are **preserved unchanged**.

## Cutover runbook

Execute these steps in order. Do not skip any step. Record the timestamp of each action.

### Step 1 — Verify prerequisites
```bash
# WP-50 and WP-51 must be done
grep -E "WP-50|WP-51" /opt/cortexos/docs/rebuild/STATUS.md

# Legacy build must exist
ls -lh /opt/cortexos/packages/dashboard/build/index.js

# Confirm service is currently running and serving legacy app
systemctl is-active cortex-dashboard.service
curl -fsS -o /dev/null -w 'legacy: %{http_code}\n' http://127.0.0.1:3080/login
```

### Step 2 — Build contracts (if dist/ is stale)
```bash
cd /opt/cortexos
pnpm --filter @cortexos/contracts build
```

### Step 3 — Build dashboard-next
```bash
cd /opt/cortexos
pnpm --filter @cortexos/dashboard-next build
```

This runs `vite build` with the Nitro `node-server` preset and emits the runnable
server under `packages/dashboard-next/.output/`. Expected output:
```
✓ Built server output: packages/dashboard-next/.output/server/index.mjs
```

Verify the entry file exists before proceeding:
```bash
ls -lh /opt/cortexos/packages/dashboard-next/.output/server/
# Must show index.mjs (or index.js — note the exact name for ExecStart)
```

**If the build fails:** do NOT proceed. Fix the build error in the relevant Wave-1/Wave-2 WP, rebuild, then retry from this step.

### Step 4 — Update the systemd template
Edit `templates/systemd/cortex-dashboard.service`:
- Change `WorkingDirectory={CORTEX_ROOT}/packages/dashboard` → `{CORTEX_ROOT}/packages/dashboard-next`
- Change `ExecStart=/usr/bin/node build/index.js` → `/usr/bin/node .output/server/index.mjs`
- Update `ReadWritePaths` to reference `{CORTEX_ROOT}/packages/dashboard-next`
- Update `Description` to `CortexOS Dashboard (TanStack/React)`
- Preserve all other directives verbatim.

### Step 5 — Render and install the updated unit
```bash
sudo bash /opt/cortexos/scripts/ops/cortex-render-units.sh cortex-dashboard.service
sudo systemctl daemon-reload
```

Verify the rendered unit before restarting:
```bash
grep -E "WorkingDirectory|ExecStart" /etc/systemd/system/cortex-dashboard.service
# Must show dashboard-next paths
```

### Step 6 — Restart the service
```bash
sudo systemctl restart cortex-dashboard.service
sleep 3
systemctl is-active cortex-dashboard.service   # must print "active"
journalctl -u cortex-dashboard.service -n 20 --no-pager
```

### Step 7 — Smoke tests
```bash
# HTTP 200 on the login page
curl -fsS -o /dev/null -w 'login: %{http_code}\n' http://127.0.0.1:3080/login

# API health (public endpoint)
curl -fsS http://127.0.0.1:3080/api/health 2>/dev/null | head -c 200

# PAM login smoke test (requires a valid OS account in cortexos-admin)
curl -fsS -X POST http://127.0.0.1:3080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"<admin-user>","password":"<admin-pw>"}' \
  -c /tmp/smoke-cookies.txt \
  -w '\nHTTP %{http_code}\n'
# Expected: HTTP 200 + Set-Cookie: cortexos_session=... + cortexos_csrf=...

# Authenticated endpoint
CSRF=$(grep cortexos_csrf /tmp/smoke-cookies.txt | awk '{print $7}')
curl -fsS http://127.0.0.1:3080/api/auth/me \
  -b /tmp/smoke-cookies.txt \
  -H "x-csrf-token: $CSRF" | head -c 200
# Expected: {"user":{...},"session":{...}}

# Clean up
rm -f /tmp/smoke-cookies.txt
```

If any smoke test fails: **immediately execute the rollback runbook below.**

### Step 8 — Update STATUS.md and DEPLOY.md
```
WP-52 done — cutover complete <ISO timestamp>, dashboard-next serving :3080
```

---

## Rollback runbook

Execute immediately if smoke tests fail or the service does not start.

```bash
# Step R1 — Edit the template back to legacy paths
# (or keep a backup of the old template — see Note below)
sudo bash /opt/cortexos/scripts/ops/cortex-render-units.sh cortex-dashboard.service
# The template must point back to packages/dashboard / build/index.js

# Step R2 — Reload and restart
sudo systemctl daemon-reload
sudo systemctl restart cortex-dashboard.service

# Step R3 — Verify legacy is serving again
sleep 3
systemctl is-active cortex-dashboard.service
curl -fsS -o /dev/null -w 'rollback: %{http_code}\n' http://127.0.0.1:3080/login
```

> **Rollback time target:** < 90 seconds from decision to serving. The legacy
> `packages/dashboard/build/index.js` is never deleted or overwritten by this WP.

**Before starting Step 4**, save a backup of the current template:
```bash
cp /opt/cortexos/templates/systemd/cortex-dashboard.service \
   /opt/cortexos/templates/systemd/cortex-dashboard.service.pre-cutover
```
This makes Step R1 a single `cp` + re-render rather than a manual edit under pressure.

---

## Acceptance criteria

- [ ] `pnpm --filter @cortexos/dashboard-next build` exits 0.
- [ ] `.output/server/index.mjs` (or `.output/server/index.js`) exists after build.
- [ ] `systemctl is-active cortex-dashboard.service` prints `active` after restart.
- [ ] `curl http://127.0.0.1:3080/login` returns HTTP 200 from the new app.
- [ ] PAM login smoke test returns HTTP 200 with session + CSRF cookies.
- [ ] `GET /api/auth/me` with the smoke session returns a valid user object.
- [ ] Legacy `packages/dashboard/build/index.js` still exists (rollback available).
- [ ] `templates/systemd/cortex-dashboard.service` committed with new paths.
- [ ] `docs/rebuild/DEPLOY.md` updated to reflect new build + restart commands.
- [ ] `STATUS.md` updated.

## Verification commands

```bash
# Full post-cutover verification
systemctl status cortex-dashboard.service --no-pager
journalctl -u cortex-dashboard.service -n 50 --no-pager
curl -fsS -o /dev/null -w 'HTTP %{http_code}\n' http://127.0.0.1:3080/login
ls -lh /opt/cortexos/packages/dashboard/build/index.js        # rollback still present
ls -lh /opt/cortexos/packages/dashboard-next/.output/server/  # new build present
grep ExecStart /etc/systemd/system/cortex-dashboard.service   # shows dashboard-next path
```

## Notes / gotchas

- The `EnvironmentFile` path (`/opt/cortexos/.secrets/dashboard.env`) does not change — the new app reads the same env vars (`DB_PASSWORD`, `CORTEX_MASTER_KEY`, `CORTEX_AUTH_PAM_SERVICE`, etc.).
- `HOST=127.0.0.1` and `PORT=3080` env vars are set inline in the unit — the new app must honour them. Confirm `packages/dashboard-next/src/server/runtime.ts` reads `process.env.HOST` and `process.env.PORT` (from WP-00).
- The unit runs as `root` — this is required for PAM (`authenticate-pam` native binding must call PAM as root) and for Docker/Incus/systemd exec bridges.
- `ProtectSystem=strict` + `ReadWritePaths` must include `packages/dashboard-next` so Nitro can write its runtime files. If the app fails to start with a permission error, add the missing path to `ReadWritePaths`.
- Do not use `systemctl enable` again — the unit is already enabled. Only `daemon-reload` + `restart` are needed.
- WP-53 and WP-54 must not start until this WP is marked done in `STATUS.md`.
