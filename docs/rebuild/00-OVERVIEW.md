# CortexOS Dashboard Rebuild — Orchestration Overview

> **Audience:** AI agents (and humans) executing the dashboard rebuild. Read this first,
> then `01-API-CONTRACT.md` and `02-CONVENTIONS.md` before touching code. Pick a work
> package from `03-WORK-BREAKDOWN.md` and its file under `wp/`.

## Goal

Make the open-source template **`bloodf/sys-pilot`** the **1-1 source of truth for all
visual design, components, and UX**. CortexOS code provides **only the data / API**. The
app switches from SvelteKit to **React (TanStack Start)**.

- **New app:** `packages/dashboard-next` — vendored sys-pilot (TanStack Start + React 19 +
  Vite 7 + shadcn/ui + Tailwind v4 + TanStack Router/Query + Recharts + xterm). Already
  vendored, pnpm-converted, building green (Phase 0 done).
- **Legacy app:** `packages/dashboard` (SvelteKit) — **stays live and untouched** until the
  cutover. It is the reference implementation for all backend logic and the source to port.
- **Backend:** ~70% of the legacy server code is framework-agnostic Node/TS and ports
  as-is; ~30% (auth/route glue) is rewritten for TanStack. All of it ends up **inside
  `packages/dashboard-next`** served as `/api/*` routes (single app, same-origin).

## End-state architecture

```
packages/dashboard-next/                 (the only app after cutover)
  src/
    routes/            TanStack file-based routes (UI) + api/ (server routes)
    server/            ported backend: db, auth, bridges, health, mail-guardian, ...
    mocks/api.ts       <-- the seam being REPLACED by a real API client
    components/ app/ features/ hooks/ i18n/   (sys-pilot UI — keep 1-1)
  migrations/          (ported from legacy; same Postgres `cortex_dashboard`)
```
- Runtime: systemd `cortex-dashboard.service`, root, port 3080, Nitro **node-server**
  output (`node <entry>`), `EnvironmentFile=/opt/cortexos/.secrets/dashboard.env`.
- DB unchanged. `@cortexos/contracts` reused by both server and client.

## The parallelization model (waves)

Work is split so independent agents never edit the same files. The **interfaces are frozen
first** (`01-API-CONTRACT.md`), which decouples backend from frontend.

- **Wave 0 — Foundation (SEQUENTIAL, blocks everything).** Node-server preset + server
  scaffolding + the `defineApiRoute` wrapper + auth/session/CSRF/RBAC core + DB port. After
  Wave 0, the server primitives and the API contract exist.
- **Wave 1 — Backend domains (PARALLEL).** One agent per `/api/*` domain. Each only adds
  files under its own `src/server/<domain>` + `src/routes/api/<domain>`. No shared-file
  edits. ~12 packages run concurrently.
- **Wave 2 — Frontend wiring (PARALLEL).** One agent per route-group. Each replaces that
  group's data source (mock → real API client) and wires actions. Depends on the contract
  (Wave 0) — can start against the contract even before the matching backend domain lands,
  using the typed client.
- **Wave 3 — Verify & cutover (SEQUENTIAL).** Security test gate, per-route parity, build
  node output, swap systemd, rollback path.
- **Wave 4 — Post-cutover (PARALLEL-ish).** i18n es/pt-br, legacy removal, docs.

```
Wave0 ──► Wave1 (12 parallel) ─┐
      └─► Wave2 (12 parallel) ─┼─► Wave3 (cutover) ──► Wave4
                               ┘
```

## Golden rules (every agent MUST follow)

1. **Never fabricate data.** If a route has no backend, ship a real empty-state, not mock
   data. Fake/mock data leaking to production is what caused the original mess.
2. **Do not break auth.** The PAM/session/CSRF/RBAC/approval port is security-critical.
   Follow `02-CONVENTIONS.md` exactly; never log secrets; never weaken a gate to "make it
   pass." Auth changes are gated by the security suite (WP-50) before cutover.
3. **Keep the legacy app live.** Do not edit `packages/dashboard` (legacy) except where a WP
   explicitly says so. The live dashboard must keep serving until WP-52 cutover.
4. **Stay in your lane.** Each WP lists the paths it OWNS. Only edit those. If you need a
   shared change, it belongs to a Wave-0 WP — request it, don't fork it.
5. **Preserve the `/api/*` contract.** It is frozen in `01-API-CONTRACT.md`. Changing a
   shape requires updating that doc + notifying dependent WPs.
6. **Keep sys-pilot's UI 1-1.** Do not restyle or re-lay-out sys-pilot components; only
   swap their data source and wire real actions. Visual parity is the whole point.
7. **Verify before "done."** Each WP has acceptance criteria. Run `pnpm --filter
   @cortexos/dashboard-next build` + the relevant tests; check against the live host where
   applicable.

## How to use this kit with an AI harness

- Assign one WP file (`wp/WP-XX-*.md`) per agent. The file is self-contained: objective,
  dependencies, files to read, files to own, steps, acceptance, boundaries.
- Respect the dependency graph in `03-WORK-BREAKDOWN.md` — don't start a WP whose
  `depends-on` is unfinished (check `STATUS.md`).
- Agents update `STATUS.md` (one line) when they start/finish a WP.
- The contract (`01`) and conventions (`02`) are the shared source of truth; when in doubt,
  defer to them and to the legacy implementation in `packages/dashboard/src/lib/server`.

## Key references
- Plan of record: `/home/cortexos/.claude/plans/ticklish-questing-moler.md`
- Legacy backend to port: `packages/dashboard/src/lib/server/**`, `packages/dashboard/src/routes/api/**`
- Contracts: `packages/contracts` (`@cortexos/contracts`)
- Template upstream: `bloodf/sys-pilot` (MIT) — vendored at `packages/dashboard-next`
