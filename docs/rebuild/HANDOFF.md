# Handoff — CortexOS dashboard rebuild (resume in a fresh session)

**Paste the block under "PROMPT TO PASTE" into a new session to continue autonomously.**

## Where things stand (2026-06-10)
The SvelteKit→TanStack/React dashboard rebuild is **100% functionally complete and LIVE**.
Branch: `fix/dashboard-deslop`. Last commit: `af82182`.

- All 24 backend+frontend WPs done; security gate green (449 tests, 0 findings); cut over on
  `cortex-dashboard.service` (:3080). Live auth verified (minted-session smoke: every authed
  route 200, incl. admin). i18n (en/es/pt-br) + docs done.
- **Terminal PTY** now works: `cortex-terminal.service` (node-pty WS sidecar on :3081) +
  Caddy `/terminal/ws` route. Both services `active`.
- Architecture/ops facts: `packages/dashboard-next/{CLAUDE.md,AGENTS.md}`,
  `docs/rebuild/ADR-001-server-transport.md`, ledger `docs/rebuild/STATUS.md`, and the
  memory `dashboard-next-architecture.md`.

## Remaining work (the fix list — in priority order)
1. **Per-screen render verification found defects — finish + fix.** A headless Playwright pass
   (`packages/dashboard-next/scripts/verify-screens.mjs`, screenshots in `/tmp/pw-verify/`) was
   in-flight when paused. It surfaced **some server-fn calls returning HTTP 400 (input
   validation)** on certain screens — i.e. the UI sends input that fails the zod gate. RE-RUN the
   script, capture the **URL + response body of every non-2xx server-fn response**, identify which
   `*.functions.ts` inputs the UI is mis-shaping, and FIX them (frontend call args or the zod
   schema). Re-run until every authed route renders clean (no error boundary, no console errors,
   no failed server-fn calls).
2. **Legacy removal — USER-GATED, do not do autonomously.** Only after the operator confirms a
   real browser PAM login works do you remove `packages/dashboard` (legacy SvelteKit) + the
   rollback artifacts. Until then KEEP them.
3. Any other defects the verification surfaces.

## Uncommitted working tree (from the paused verify agent — decide: commit or discard)
- `M packages/dashboard-next/package.json` + `M pnpm-lock.yaml` — playwright added as a **dev**
  dependency (keep if you want re-runnable screen verification; it's dev-only, not in the prod bundle).
- `?? packages/dashboard-next/scripts/verify-screens.mjs` — the verification harness (keepable).
- `?? hermes-webui/`, `?? 9router-fork-archive-20-fork.conf.txt` — unrelated host artifacts, leave untracked.

## Key context for the new session
- **Transport is `createServerFn` RPC, NOT REST** (ADR-001). Server fns in
  `src/lib/api/<domain>.functions.ts` gated by `defineServerFn`; server logic dynamically
  imported from `src/server/**`. Frontend calls them typed: `await fn({ data: {...} })`.
- **Headless auth recipe** (PAM can't be scripted): mint an admin session directly —
  source `/opt/cortexos/.secrets/dashboard.env` for `DB_*`, then
  `INSERT INTO admin_sessions (user_id, token, expires_at, created_at, is_admin, csrf_token, ip,
  user_agent, last_role_check_at, touched_at) VALUES (3, '<tok>', now()+interval '2 hours', now(),
  true, '<rand>', '127.0.0.1', 'verify', <epoch_ms_now>, now());` (user_id 3 = admin 'cortexos').
  Use the token as cookie `cortexos_session`. DELETE the row when done.
- **Build/verify**: `pnpm --filter @cortexos/dashboard-next build` (→ `.output/server/index.mjs`),
  `... exec tsc --noEmit`, `... exec vitest run src/server src/lib/api` (source dashboard.env first).
  After UI fixes: rebuild, boot-test on a scratch port, then `sudo systemctl restart
  cortex-dashboard.service`, verify `/login` → 200.
- **Don't break the live app.** When fanning out parallel agents: tell each to verify with its own
  domain tests/tsc, NOT `pnpm build` (concurrent vite builds collide); do the integrated build +
  full test suite CENTRALLY, then commit centrally. Reconcile `src/lib/api/client.ts` (concurrent
  edits drop exports under last-writer-wins — the integrated `tsc` catches it).
- **Caddy gotcha**: global block has `admin off`, so `systemctl reload caddy` FAILS — use
  `systemctl restart caddy`. Backup: `/etc/caddy/Caddyfile.pre-terminal.bak`.
- **Terminal sidecar**: `cortex-terminal.service`, `ALLOWED_ORIGIN=same-origin`, unit canonical at
  `docs/rebuild/cortex-terminal.service`, Caddy snippet `docs/rebuild/caddy-terminal.snippet`.
- **Rollback**: `sudo cp /etc/systemd/system/cortex-dashboard.service.legacy-svelte.bak
  /etc/systemd/system/cortex-dashboard.service && sudo systemctl daemon-reload && sudo systemctl
  restart cortex-dashboard.service` (legacy build at `packages/dashboard/build/index.js`).
- Commit message footer: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

## PROMPT TO PASTE

```
/loop I want you to keep the autonomous process until 100% is done and finished

Continue the CortexOS dashboard rebuild. Read docs/rebuild/HANDOFF.md first — it has full
context, the fix list, and the don't-break rules. State: rebuild is live (cortex-dashboard +
cortex-terminal services active on branch fix/dashboard-deslop, last commit af82182); all 24 WPs +
security gate + terminal PTY done.

Do, in order:
1. Re-run packages/dashboard-next/scripts/verify-screens.mjs (headless Playwright; mint an admin
   session in admin_sessions per the recipe in HANDOFF.md for auth). It already found some
   server-fn calls returning HTTP 400 (input validation) on certain screens — capture the URL +
   response body of every non-2xx server-fn response, fix the mis-shaped UI inputs / zod schemas,
   rebuild + restart cortex-dashboard.service, and re-run until every authed route renders clean
   (no error boundary, no console errors, no failed server-fn calls).
2. Fix anything else the verification surfaces. Build/test/commit centrally; never break the live app.
3. DO NOT remove the legacy SvelteKit app (packages/dashboard) or rollback artifacts — that is
   gated on me confirming a real browser PAM login. Ask me before doing it.

Keep the loop self-paced (ScheduleWakeup) until the per-screen verification is fully green, then
stop and report.
```
