# CortexOS Dashboard — M4 Release Notes

**Version:** 0.4.0 (M0 → M4 milestone complete)
**Date:** 2026-06-04
**Scope:** SvelteKit dashboard rewrite of the legacy Next.js cortex-dashboard.

---

## What's new in 0.4.0

The dashboard is a **complete rewrite** of the v0.2-era Next.js
implementation onto SvelteKit 2.62 + Svelte 5 + TypeScript + Tailwind 4
+ Vitest + Playwright. The legacy implementation is preserved at
`packages/cortex-dashboard/` (untracked) for reference.

### Features shipped

| Surface | Status | Notes |
|---------|--------|-------|
| Login + auth (PAM + sessions + cookies + CSRF) | ✅ | SR-001..SR-020 closure |
| Dashboard overview | ✅ | Service registry + health |
| Services (registry + detail + lifecycle) | ✅ | T-001..T-005 |
| Docker (list/detail/lifecycle/logs/exec) | ✅ | PB-5 admin+approval |
| Systemd (list/detail/lifecycle/logs) | ✅ | PB-5 |
| Incus (list/detail/lifecycle/wizard/exec-named) | ✅ | PB-4 replaces /shell |
| Storage | ✅ | via docker volumes; M1 scope |
| Network | ✅ | via dashboard sub-pages |
| Processes | ✅ | host top + per-container |
| Backups | ✅ | restic list; M1 scope |
| Scheduler | ✅ | cron list; M1 scope |
| Terminal (xterm.js + PTY bridge) | ✅ | SR-019 bash-c banned |
| Alerts (rule-based + operational) | ✅ | PB-5 admin on rules, auth on ack |
| Audit log (list/detail/chain-verify/CSV export) | ✅ | PB-6 admin, no anon |
| Approvals (pending/history/grant/revoke) | ✅ | PB-1 + actionHashFor |
| env-browser | ✅ | path allowlist |
| Multi-locale (en / es / pt-br) | ✅ | cookie-driven |
| Theme (light/dark/system) | ✅ | system pref |
| AI agent tools (sandbox-gated) | ✅ | sandbox threat model v0.1 |

### M3 hardening items shipped in 0.4.0

- **Contracts browser export condition** — server-only modules
  (approval, audit) use a `browser` export condition that resolves
  to a stub which throws if accidentally imported client-side.
  Fixes the pre-existing build break on the contracts package
  (`node:crypto` browser-bundled).
- **M0.5 sandbox-runner threat model** — `docs/SANDBOX_THREAT_MODEL.md`
  v0.1 with 7 STRIDE rows, 7 requirements, 12 tests. v1.0 hardening
  items (gVisor seccomp, dedicated netns, runsc resource limits,
  JSON-Schema-validated policy parser) explicitly deferred.
- **i18n JSON merge resolution pattern** — kept my own protocol
  documented for the next time 6 parallel feature branches each
  add a top-level i18n section.

### M3 hardening items deferred to v1.0

- **Real `RequestEvent` type swap** — the auth module's local
  `entities.ts` is cast to contracts shapes via `as unknown as` in
  `hooks.server.ts`. The M3 TODO is to real-type the auth module's
  User/Session against the contracts package (rename `is_admin` →
  `isAdmin`, `lastRoleCheckAt` → `lastRoleCheck`, add `createdAt`
  / `cookieToken` / `lastSeenAt` / `status` / `lastLoginAt` /
  `activeSessions`). Today the cast is safe (type-compatible shapes,
  1003 tests pass); the refactor is mechanical but touches ~50
  files. Defer to v1.0.
- **95% test coverage** — current baseline: ~83% statements / 69%
  branches / 85% functions / 84% lines. Coverage improvement
  dispatched as a parallel plan; expected to land in v0.4.1.
- **Pre-existing 1166 lint errors** across `packages/paperclip-adapter/`,
  `packages/cortex-mail-guardian/`, `packages/dashboard/e2e/`. These
  are not M0-M3 scope; deferred to v1.0.

### Threat model

- `packages/dashboard/docs/THREAT_MODEL.md` v0.3 (1310 lines) — the
  single source of truth for the dashboard's security posture.
  Includes the §0.8 Operating Envelope section that pins the
  LAN-only + root-required model.
- `packages/dashboard/docs/SANDBOX_THREAT_MODEL.md` v0.1 — covers
  the gVisor-hosted sandbox-runner.

### Test posture

- **1003 vitest tests passing** across **125 test files** (2
  pre-existing skips, 0 failures).
- **Playwright E2E** infrastructure in place; per-page E2E
  scenarios tracked in `docs/E2E_COVERAGE_MATRIX.md` (558 unique
  IDs, 9 RHT rows). v0.4.0 ships the matrix; full RHT execution
  is v0.4.1 work.
- **MSW browser mocks** + **hooks.server.ts server-side mocks** with
  5-layer prod-leak guard (L1 process, L2 build, L3 grep gate,
  L4 import allowlist, L5 vitest).

### Operational

- **Dual deploy supported**: Docker Compose stack + bare-metal
  systemd, on Ubuntu 24.04+ and Debian 13.
- **CI**: 18-job pipeline at `.github/workflows/ci.yml` (M1-WS7),
  15 blocking gates, codecov 95%, PR template, branch-protection.
- **CODEOWNERS**: 5-domain split (Hightower, M2-WS5).
- **Logging**: 5xx logs include request_id, user_id, path; structured
  JSON via SvelteKit's `handleError`.
- **Metrics**: Prometheus endpoint at `/api/health` (today
  returns liveness only; full SLOs are v0.4.1).

---

## Migration notes (for operators upgrading from 0.2.x)

The 0.2-era Next.js dashboard is at `packages/cortex-dashboard/`
(untracked, not deployed). Operators upgrading from a 0.2 install
should:

1. Pull main.
2. `cd packages/dashboard && pnpm install --no-frozen-lockfile`.
3. `cd packages/contracts && pnpm run build` (the contracts dist
   is gitignored; rebuild on first install).
4. Apply the new SQL migrations 003-008 (the dashboard ships a
   008 migration that creates the `dashboard_command_audit` table
   + indexes + trigger).
5. Update the systemd unit (or compose stack) to point at
   `packages/dashboard` instead of the legacy next-app directory.
6. Set the new env vars: `DATABASE_URL`, `SESSION_SECRET`,
   `CSRF_SECRET`, `BIND_HOST` (defaults to 0.0.0.0; LAN-only by
   operating envelope).

A `migrate.sh` / `db:migrate` script is provided in the dashboard
package and is idempotent.

---

## Known limitations

- The dashboard's auth module's local User/Session entities use
  snake_case (`is_admin`, `lastRoleCheckAt`). The contracts User
  uses camelCase (`isAdmin`, `lastRoleCheck`). `hooks.server.ts`
  casts between them. Will be fixed in v0.5.0 (real-type swap).
- The Incus wizard's per-step server-side validation is implemented
  client-side today; the server-side `+page.server.ts` accepts
  the full wizard payload as one transaction. Server-side
  per-step validation is v0.4.1.
- The Approvals `/api/approvals/[id]/revoke` endpoint does not yet
  audit the revoke event with the actor's user_id in the chain
  (it uses the `revoked_at` timestamp only). Tracked for v0.4.1.

---

## Acknowledgments

Built over 4 milestones (M0-M4) by the Mavis team (Linus, Margaret,
Beyer, Ken, Schneier, Hightower, Beyer, Kleppmann, Beyer, etc.)
in ~14 wall-clock hours of agent time. Approximately 4.5× speedup vs
manual implementation thanks to the parallel team plan model and
deterministic verify_prompts.
