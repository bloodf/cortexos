# CortexOS Remediation — Session Handoff

> Paste the block below into a fresh session to execute the remediation plan. It is self-contained: it points at the detailed plan file (34 findings with file:line) and carries the operating process, decisions, sequence, and gotchas.

---

You are the implementation lead for a CortexOS remediation pass. A full read-only multi-agent audit already ran; the prioritized fix plan lives at **`/home/cortexos/.claude/plans/streamed-splashing-stearns.md`** — read it first. It has 34 findings (P0→P3) grouped into themes, each with concrete `file:line` evidence and a fix approach. Work it top-to-bottom in the plan's "Sequencing (honesty-first)" order.

## Operator decisions (already made — do not re-ask)
- **Build real backends** for the fake control actions (agent start/stop/restart/pause, ⌘K "Restart caddy", docker prune) — not just disable them.
- **Backfill** the 359 historical mail-guardian reviews from the IMAP Review mailbox.
- **English-only**: drop the es/ptBR locale switcher rather than half-translate.
- Scope = **everything (P0–P3)**.

## Environment / where things live
- Monorepo `/opt/cortexos` (pnpm, Node 22). Always `cd /opt/cortexos` first (CWD traps are real).
- Dashboard `packages/dashboard-next` — TanStack Start + React 19 + Vite; **transport is `createServerFn` RPC only** (no REST). Server fns in `src/lib/api/<domain>.functions.ts` gated by `src/lib/api/define-server-fn.ts`; server-only logic in `src/server/**`; Drizzle + Postgres `cortex_dashboard`; PAM auth. Adapters `src/lib/adapters/*` map rows → UI shapes. Runs as **systemd `cortex-dashboard.service`** on `127.0.0.1:3080` (Caddy TLS in front).
- `packages/cortex-mail-guardian` (systemd `cortex-mail-guardian.service`), `packages/cortex-terminal` (PTY+WS sidecar `cortex-terminal.service` :3081), `packages/contracts` (zod).
- Host scripts in `scripts/` are **gitignored host-local** (edit in place; not committed). `stacks/*/docker-compose.yml`, `memory-os/` are also host-local.
- DB creds: `set -a; source /opt/cortexos/.secrets/dashboard.env; set +a` (then `psql -h 127.0.0.1 -U "$DB_USER" -d "$DB_NAME"`). `.secrets/` dir must stay `0755`. Never commit secrets.

## Gates (every change must keep these green)
- `pnpm lint` → **rc=0, no output** (TRUE ZERO; no new `eslint-disable` in first-party src). NOTE: it is currently RED — fixing that is plan item 0.1, do it first.
- `pnpm run format:check` rc=0 · `pnpm run typecheck` rc=0 (6 packages).
- `pnpm run test` = the **serial** aggregate (`--workspace-concurrency=1`) → ~1019 tests across 6 packages. Keep it serial: running suites concurrently flakes a 5s-timeout migration test (`migrate-filter > drops CREATE EXTENSION timescaledb`); it passes in isolation.

## Deploy + verify loop (per UI change)
1. `pnpm --filter @cortexos/dashboard-next build`
2. `sudo systemctl restart cortex-dashboard.service` (NOT reload) → `curl -fsS -o /dev/null -w '%{http_code}\n' --retry 5 http://127.0.0.1:3080/login` must be 200.
3. **Screenshot-verify** with the session-minted Playwright harness `/tmp/macos-shots/shot.mjs` (mints an `admin_sessions` row for `user_id=3`, sets `cortexos_session`/`cortexos_csrf` cookies, snaps routes to PNG you can Read). For write paths, write a small Playwright script that drives the UI then asserts the DB row changed (pattern used this session: `badge-write.mjs`, `kill-write.mjs`). Real chromium at `/snap/chromium/current/usr/lib/chromium-browser/chrome`.
4. Mail/host changes: restart the relevant service and check `journalctl -u <unit> --since '-1min'` clean; `systemctl --failed` should trend toward clean.

## Working rules
- **One fix → one commit**, gates green before committing. Commit messages end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`. Push when a coherent unit is done + verified.
- **Build/review separation**: don't self-approve risky work; add tests for each fix (the audit's #1 meta-lesson: tests passed while prod broke because fixtures used UUID strings, not the real integer ids). New tests must feed **real DB-shaped rows**.
- Stop and ask before: deleting files outside the plan's scope, schema migrations beyond the plan, force-push, or anything genuinely destructive on the host beyond the plan's named cleanups.
- Track progress with TaskCreate/TaskUpdate per plan phase.

## Known gotchas (hard-won this session)
- **React Query swallows rejected `queryFn` promises** → the component renders an empty default with **no console error**. So an adapter that throws on one row silently blanks the whole page. This is the "hashId class" (item 1.1/1.2).
- Several `services`/`alerts`/etc. ids are **integer serial**, not the UUID the contract types claim — adapters that do `id.replace(...)` throw. Live mappers for alerts/audit/approvals/incus are **inline in `src/lib/api/client.ts`** (~675/687/699/722, incus 459); the files in `src/lib/adapters/{alerts,audit,approvals,incus}.ts` are **dead code** — fix the live ones.
- Reuse, don't reinvent: gated mutation pattern = `defineServerFn({...}) → createServerFn().middleware([gate]).handler(serverFnNoop)` (template: `systemd.functions.ts`); privileged UI dispatch = `callMintApproval` + `callSystemdAction` + `csrfHeaders()` (`features/Systemd.tsx` `dispatchSystemdAction`); durable audit writer already exists at `src/server/db/repos/audit.ts:369` (`appendAuditLog`).
- Two audit findings had **corrected diagnoses** (in the plan): the mail backlog root cause is `store.ts` `updateDecisionOutcome` being a no-op UPDATE + a `config.ts` bot-token copy-paste gate (NOT the dashboard wiring, which is already done); and the HMAC-key finding's "audit chain breaks" claim is false (chains use sha256). Trust the plan's corrected text.

## First actions in the new session
1. Read the plan file. 2. Confirm current state: `cd /opt/cortexos && pnpm lint` (expect the one `no-bitwise` RED), `git log --oneline -8`, `systemctl --failed`. 3. Start at plan **0.1** (lint) and proceed honesty-first.
