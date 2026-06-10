# CortexOS Dashboard Rebuild Kit

A self-contained set of plans + work packages to rebuild the dashboard **1-1 on the
`bloodf/sys-pilot` React/TanStack template, with CortexOS code as the API**, executable by
**multiple AI agents in parallel**.

## Read order
1. `00-OVERVIEW.md` — goal, architecture, waves, golden rules.
2. `01-API-CONTRACT.md` — the frozen `/api/*` interface (backend ⇄ frontend decoupling).
3. `02-CONVENTIONS.md` — server primitives, auth model, client pattern, Definition of Done.
4. `03-WORK-BREAKDOWN.md` — the 34 WPs, dependency graph, per-WP briefs, file template.
5. `wp/WP-XX-*.md` — one self-contained spec per work package (hand one to one agent).
6. `STATUS.md` — the live ledger; check before starting, update on start/finish.

## How to run it with an AI harness

1. **Bootstrap (one agent, sequential):** assign Wave 0 in order — WP-00, WP-02, WP-03,
   then WP-01; WP-04 can run alongside. Each agent reads `00–03` + its `wp/` file. After
   Wave 0, the server primitives + API contract + client seam exist.
2. **Fan out (many agents, parallel):** assign every Wave 1 WP (backend, ~12) and every
   Wave 2 WP (frontend, ~12) to its own agent. They don't collide — each owns disjoint paths
   (see each WP's `Owns`). Frontend WPs can begin against the typed client even before their
   backend domain lands.
3. **Converge (one agent, sequential):** WP-50 (security gate — must be green) → WP-51
   (parity) → WP-52 (cutover). Then WP-53/54.

### Prompt skeleton for a worker agent
> "Execute work package `docs/rebuild/wp/WP-XX-*.md` for the CortexOS dashboard rebuild.
> First read `docs/rebuild/00-OVERVIEW.md`, `01-API-CONTRACT.md`, `02-CONVENTIONS.md`, and
> your WP file. Follow the golden rules. Edit ONLY the paths your WP `Owns`. Meet every
> acceptance criterion and run the verification commands. Update `docs/rebuild/STATUS.md`
> when you start and finish. Do not touch the legacy `packages/dashboard` app."

### Coordination rules (recap)
- Don't start a WP until its `Depends-on` rows are `done` in `STATUS.md`.
- The contract (`01`) is frozen; changing a shape means editing `01` + flagging dependents.
- Never fabricate data; never weaken an auth gate; keep sys-pilot's UI 1-1; keep the legacy
  app live until WP-52.

## Current state (entry point)
- New app vendored + building: `packages/dashboard-next` (commit `f6a5ce5`).
- Backend to port (the API), hardened: `packages/dashboard` + commit `57a06d3`.
- Plan of record: `/home/cortexos/.claude/plans/ticklish-questing-moler.md`.
- **Next action:** Wave 0 → start with `wp/WP-00-node-server-preset.md`.
