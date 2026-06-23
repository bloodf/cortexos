# Implementation Plans — `/improve deep` (Agent Generator + Dashboard)

Generated 2026-06-23, planned at commit `4f1a73a9`. Scope audited:
`packages/dashboard-next/src` + `packages/cortex-agent-generator`.
Executors work in waves; the lead reviews every diff and runs the gates
(`pnpm --filter @cortexos/dashboard-next typecheck|lint|test`) before commit.

## Status

| # | Title | Cat | Effort | Wave | Status |
|---|-------|-----|--------|------|--------|
| 1 | Incus stop/restart/delete approval fail-closed (mint `{action,name}` vs hash `{name}`) | sec | S | 1-B | DONE — committed |
| 2 | `migrate-cli.js` wrong ledger (`migrations` vs `dashboard_migrations`) + docs lie | debt/dx | S | 1-D | DONE — committed |
| 3 | Attachments re-attached to every historical user turn (`llm.ts`) | bug | S | 1-A | DONE — committed |
| 4 | `openaiClient()` throws outside try in WS sidecar | bug | S | 1-A | DONE — committed |
| 5 | WS disconnect never clears `thinking` | bug | S | 1-A | DONE — committed |
| 6 | `service_health_log` unbounded growth (no prune) | perf | S | 1-C | DONE — committed |
| 7 | Mail stats 7 COUNT queries → 1 conditional aggregation | perf | S | 1-C | DONE — committed |
| 8 | Batch update per-id loop (`inArray` available) | perf | S | 1-C | DONE — committed |
| 9 | `alerts/history` polled 3s for 60s-cadence data | perf | S | 1-C | DONE — committed |
| 10 | RPC image encoding mismatch (raw base64 vs `data:` URL) | bug | S | 1-A | DONE — committed |
| 11 | Attachments past cap silently dropped (WS) | bug | S | 1-A | DONE — committed |
| 12 | `createSession` returns `inserted[0]` unguarded | bug | S | 1-A | DONE — committed |
| 13 | WS sidecar leaks upstream LLM error text to client | sec | S | 1-A | DONE — committed |
| 14 | No `.env.example` for either package | dx | S | 1-E | DONE — committed |
| 15 | `requestId` never returned in a response header | dx | S | 1-E | DONE — committed |
| 16 | JSONB read-modify-write races + unawaited `appendBuildLogs` | bug | M | 1-A | DONE — committed |
| 19 | docker bridge `dispatch()` untested | tests | M | 2 | DONE — committed |
| 20 | `DbSessionStore` untested | tests | M | 2 | DONE — committed |
| 21 | docker bridge no leading-dash/`--` guard (flag injection) | sec | S | 1-B | DONE — committed (with #1) |
| 17 | Attachment UI duplicated across generator + chat | debt | S-M | 2 | DONE — committed |
| 18 | recharts/xterm/streamdown statically bundled on all routes | perf | M | 2 | REJECTED — see note |

## Held — deliberate handling, not blind auto-implementation

- **Direction D1–D6** (features/spikes — need product decisions): agent lifecycle delete/reconfigure, spec-edit-before-build, interview-configurable fallback models, channel automation, stream chat replies, productize MCP packages.
- **Large migrations** (high blast radius on the live system): AI SDK v5→v6, Vite 7→8 (+esbuild advisory), `client.ts` facade rewrite (ARCH-02/06), `@lovable.dev` Vite-wrapper extraction (DEPS-04), `AgentGenerator.tsx` god-component split (ARCH-04), multi-profile team (D4).
- **Lower-leverage backlog**: remaining test gaps (PAM internals, `parseSystemctlShow`, build enable-step, mail repo writes, group-gated routes, kill path, build-argv assertion), dep version aligns (nitro/pglite/vitest/pg/recharts), DX docs (README `bun`, Node 22/24, sidecar AGENTS.md), PERF-03/04 widget polling, ARCH-05/07.

## Findings considered and rejected (do not re-audit)
- #18 (code-splitting recharts/xterm/streamdown): premise false. Build output shows routes are already split (per-route chunks) and recharts is already its own 339KB async chunk (AreaTrend-*.js), xterm in its route chunk — they do NOT load on every route. Only residual would be lazy-loading the mermaid streamdown plugin: MED-risk SSR change, marginal two-route gain. Not worth it.
- Incus *bypass* (earlier P5a claim): not a bypass — destructive actions are bridge-gated. The real bug is #1 (fail-closed). Cleared.
- Duplicate SYSTEM_PROMPT (sidecar + llm.ts): intentional, kept byte-identical. Not a finding.
