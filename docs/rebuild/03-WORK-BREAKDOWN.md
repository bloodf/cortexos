# Work Breakdown — 34 work packages across 5 waves

> Each WP has a self-contained file under `wp/WP-XX-*.md`. Respect `depends-on`. Edit only
> `OWNS` paths. Update `STATUS.md` on start/finish. Conventions in `02`, contract in `01`.

## Dependency graph

```
WAVE 0 (foundation, mostly sequential)
  WP-00 node-server preset + runtime boot
  WP-02 DB port ───────────────┐
  WP-03 security cores ─────────┼──► WP-01 request core (defineApiRoute, auth/session/csrf/rbac)
  WP-04 frontend api-client + adapters (needs only the contract)

WAVE 1 (backend domains — PARALLEL; each needs WP-01 + WP-02, some WP-03)
  WP-10 services+health   WP-11 docker     WP-12 incus      WP-13 systemd
  WP-14 system/net/proc/storage   WP-15 mail-guardian   WP-16 approvals+audit
  WP-17 alerts   WP-18 env-browser(+WP-03)   WP-19 terminal   WP-20 auth(+WP-03)   WP-21 agents

WAVE 2 (frontend route-groups — PARALLEL; each needs WP-04; pairs with its WAVE-1 domain)
  WP-30 shell/nav/auth/login   WP-31 overview   WP-32 apps+healthcheck   WP-33 docker
  WP-34 incus(+wizard)   WP-35 systemd   WP-36 system(net/storage/proc/terminal)
  WP-37 mail-guardian   WP-38 approvals+audit   WP-39 alerts   WP-40 admin   WP-41 agents

WAVE 3 (sequential):  WP-50 security suite (GATE) ► WP-51 parity verify ► WP-52 cutover
WAVE 4 (parallel-ish): WP-53 i18n es/pt-br   WP-54 legacy removal + docs
```

**Parallelism:** after Wave 0, up to ~24 agents (Wave 1 + Wave 2) can run concurrently. A
frontend WP can start against the typed client (WP-04) before its backend domain lands, using
the contract; final wiring needs the matching Wave-1 WP done.

---

## WP briefs

> Format: **ID — title** · wave · depends-on · OWNS · objective · acceptance.

### Wave 0
- **WP-00 — Nitro node-server preset + runtime boot** · W0 · — · OWNS `vite.config.ts`,
  `src/server/runtime.ts`, `src/server.ts` (SSR entry if needed), `docs/rebuild/DEPLOY.md`.
  Force Nitro `node-server` preset so `vite build` emits a runnable `node <entry>`; add a
  server-boot hook that will later start the health scheduler. **Accept:** `pnpm build`
  emits a node server; `node <entry>` serves the stock app on a port; documented run cmd.
- **WP-02 — DB port** · W0 · — · OWNS `src/server/db/**`, `migrations/**`, `scripts/migrate-cli.js`.
  Port Drizzle client, `schema.ts`, all repos (`services, audit, mail_guardian, alerts,
  pending_approvals, dashboard_command_audit, users`), and migrations 001–011 verbatim.
  **Accept:** repos compile + a smoke query against live `cortex_dashboard` returns rows;
  `migrate-cli.js` is idempotent.
- **WP-03 — Security cores (portable)** · W0 · WP-02 · OWNS `src/server/auth/pam.ts`,
  `src/server/approval/**`, `src/server/audit/**`, `src/server/env-reveal.ts`,
  `src/server/redact.ts`, `src/server/policy.ts`, `src/server/errors/**`,
  `src/server/rate-limit.ts`. Port these framework-agnostic modules verbatim (HMAC chains,
  token mint/verify/consume, PAM authenticator, allowlists). **Accept:** unit tests ported &
  green (approval single-use, audit chain verify, mask rules).
- **WP-01 — Request core** · W0 · WP-02, WP-03 · OWNS `src/server/define-api-route.ts`,
  `src/server/auth/{session-store,cookies,csrf,rbac}.ts`, `src/server/context.ts`. Rewrite
  the SvelteKit glue for TanStack: session resolution into request context, cookie+CSRF
  issuance/verification, RBAC, and the `defineApiRoute` wrapper (auth, rate-limit, CSRF,
  approval consume, audit, error envelope). **Accept:** a trivial protected `/api/_ping`
  returns 200 authed / 401 unauth / 403 non-admin / 400 on bad input; CSRF enforced on POST.
- **WP-04 — Frontend api-client + adapters** · W0 · — (contract only) · OWNS `src/lib/api/**`,
  `src/lib/adapters/**`, and the redirect plan for `src/mocks/api.ts`. Build a typed fetch +
  react-query client matching sys-pilot's existing mock function signatures, with CSRF header
  injection and the error-envelope handling; adapter scaffolding mapping `@cortexos/contracts`
  → component props. **Accept:** client compiles; one demo call (e.g. `/api/auth/me`) works
  end-to-end against the dev server; mock seam swap mechanism documented.

### Wave 1 — backend domains (parallel)
- **WP-10 — services + health** · W1 · WP-01,02 · OWNS `src/routes/api/services/**` + reuse
  `src/server/health`. Implement the services CRUD + health list/recheck per contract; wire
  the health scheduler boot (from WP-00 hook). **Accept:** endpoints match contract; live
  `GET /api/services` returns the catalog; recheck updates status.
- **WP-11 — docker** · W1 · WP-01,02 · OWNS `src/server/docker/**`, `src/routes/api/docker/**`.
  Port `real-data.ts` (images dedup + `<none>` filter) + action dispatch (allowlist, approval
  on destructive). **Accept:** containers/images/volumes lists match live `docker`; actions gated.
- **WP-12 — incus** · W1 · WP-01,02 · OWNS `src/server/incus/**`, `src/routes/api/incus/**`.
  Port the execFile bridge (list/info/actions/exec-named/logs). **Accept:** instances match live host.
- **WP-13 — systemd** · W1 · WP-01 · OWNS `src/server/system/systemd.ts`, `src/routes/api/systemd/**`.
  Unit actions (allowlist, approval) + journal logs. **Accept:** actions gated; logs stream.
- **WP-14 — system/network/processes/storage** · W1 · WP-01 · OWNS `src/server/system/**`
  (except systemd), `src/routes/api/{system,network,processes,storage}/**`. Port host readers
  incl. **physical-NIC** filter (`/sys/class/net/*/device`) and **physical-disk** filter.
  **Accept:** `/api/network` lists only physical NICs; `/api/storage` only real disks.
- **WP-15 — mail-guardian** · W1 · WP-01,02 · OWNS `src/server/mail-guardian/**`,
  `src/routes/api/mail-guardian/**`. Port the repo + account CRUD + reviews/flag/approve/batch;
  reuse `packages/cortex-mail-guardian` classifier. **Accept:** accounts list the 3 seeded rows.
- **WP-16 — approvals + audit + command-audit** · W1 · WP-01,02,03 · OWNS
  `src/routes/api/{approvals,audit,dashboard_command_audit}/**`. Mint/grant/revoke + audit
  list/verify + two-phase command audit. **Accept:** approval token single-use; chain verify ok.
- **WP-17 — alerts** · W1 · WP-01,02 · OWNS `src/routes/api/alerts/**`. CRUD + history. **Accept:** matches contract.
- **WP-18 — env-browser** · W1 · WP-01,03 · OWNS `src/routes/api/env-browser/**`. Masked GET +
  PAM-unlock reveal grant. **Accept:** no cleartext without a live grant; unlock needs valid PAM pw.
- **WP-19 — terminal** · W1 · WP-01 · OWNS `src/server/terminal/**`, `src/routes/api/terminal/**`.
  Real WebSocket PTY (allowlisted), to replace sys-pilot's mock PTY. **Accept:** a shell session runs.
- **WP-20 — auth endpoints** · W1 · WP-01,03 · OWNS `src/routes/api/auth/**`. login/logout/me.
  **Accept:** PAM login sets cookies; me returns user; logout invalidates.
- **WP-21 — agents** · W1 · WP-01 · OWNS `src/server/agents/**`, `src/routes/api/agents/**`.
  Hermes profiles registry read + scoped file upload. **Accept:** agents list from profiles.json.

### Wave 2 — frontend route-groups (parallel; pair with the matching Wave-1 domain)
- **WP-30 — shell/nav/auth/login** · W2 · WP-04 · OWNS `src/app/**` (shell), `src/routes/login*`,
  `_authenticated` guard, nav config. Real PAM login + session guard + admin gating; keep shell 1-1.
- **WP-31 — overview** · W2 · WP-04 · OWNS `src/routes/overview*`, `src/features/Overview*`. Wire widgets to `/api/system`,`/api/services`.
- **WP-32 — apps + healthcheck** · W2 · WP-04 · OWNS those routes/features. Wire to services+health.
- **WP-33 — docker pages** · W2 · WP-04 · OWNS docker routes/features. List + detail + actions + logs.
- **WP-34 — incus pages (+wizard)** · W2 · WP-04 · OWNS incus routes/features. List/detail/wizard/actions.
- **WP-35 — systemd pages** · W2 · WP-04 · OWNS systemd routes/features. List/detail/logs/actions.
- **WP-36 — system pages** · W2 · WP-04 · OWNS network/storage/processes/terminal routes/features.
  Wire real data + **real PTY terminal** (xterm → `/api/terminal` WS).
- **WP-37 — mail-guardian UI** · W2 · WP-04 · OWNS mail-guardian routes/features. Two-pane review + accounts CRUD.
- **WP-38 — approvals + audit UI** · W2 · WP-04 · OWNS those routes/features. Queue + grant/revoke; audit + chain verify.
- **WP-39 — alerts UI** · W2 · WP-04 · OWNS alerts routes/features. List/rules/history.
- **WP-40 — admin UI** · W2 · WP-04 · OWNS `src/routes/admin/**`. services/users/env-browser(reveal UX)/account/badges/projects — real data or real empty-state.
- **WP-41 — agents UI** · W2 · WP-04 · OWNS agents routes/features. List + inspect dialog.

### Wave 3 — verify & cutover (sequential)
- **WP-50 — security test suite (GATE)** · W3 · all W1 · OWNS `src/server/**/__tests__` + a
  security spec. Port/extend vitest for PAM login, session/cookie/CSRF, RBAC, approval
  single-use, env-reveal gate, rate-limits, audit chain. **Must be green before WP-52.**
- **WP-51 — parity verification** · W3 · all W1+W2 · OWNS `docs/rebuild/PARITY.md`. Per-route
  check vs live host (screens + data correctness). Log gaps as follow-up WPs.
- **WP-52 — build + systemd cutover** · W3 · WP-50,51 · OWNS `templates/systemd/cortex-dashboard.service`,
  deploy steps. Build node output; repoint `ExecStart` to dashboard-next; keep legacy build
  for instant rollback; smoke test :3080. **Accept:** live dashboard served by dashboard-next; rollback documented.

### Wave 4
- **WP-53 — i18n es/pt-br** · W4 · WP-52 · OWNS `src/i18n/**`. Port 735 keys + language switcher (sys-pilot already has an i18n dir).
- **WP-54 — legacy removal + docs** · W4 · WP-52 · OWNS `packages/dashboard` (delete), `stacks/cortex-dashboard` (retire),
  `prompts/tools/70-dashboard.md`, root `CLAUDE.md`/`AGENTS.md`. Update to TanStack/React reality.

---

## WP file template (each `wp/WP-XX-*.md` MUST follow)

```markdown
# WP-XX — <title>
- **Wave:** <0-4>   **Depends-on:** <WP ids or none>   **Parallel-safe-with:** <ids>
- **Owns (edit only these):** <glob paths>
- **Do NOT touch:** <shared files / legacy>

## Objective
<1-3 sentences: what done looks like>

## Read first
<exact files: legacy source to port, contract section, conventions section>

## Steps
1. ...

## Acceptance criteria
- [ ] matches `01-API-CONTRACT.md` (backend) / UI unchanged vs sys-pilot (frontend)
- [ ] build/tests green; verified against live host where applicable
- [ ] no edits outside OWNS

## Verification commands
<pnpm build/test, curl, psql, etc.>

## Notes / gotchas
<e.g. pnpm phantom-deps, root-only execFile, security caveats>
```
