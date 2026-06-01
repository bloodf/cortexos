# Handoff Prompt — Implement the sys-pilot redesign in cortex-dashboard

> Paste this whole file to the next engineer/agent. It is a self-contained brief to bring the full
> new design + new features from the Lovable project `https://github.com/bloodf/sys-pilot` into the
> production dashboard at `/opt/cortexos/packages/dashboard`, end-to-end. Everything below was
> audited directly from the cloned repo — it reflects what sys-pilot actually built, not guesses.

---

## 0. Mission & the one decision that governs everything

Bring sys-pilot's design, UX, components, and NEW features into production. But the two codebases are
**different frameworks**, so you cannot copy files 1:1:

| | sys-pilot (the design) | production cortex-dashboard |
|---|---|---|
| Framework | **TanStack Start v1** (React 19, Vite 7, SSR-ready) | **Next.js 16** App Router (Turbopack) |
| Routing | TanStack Router, file-based (`src/routes/*`, dots→slashes) | Next App Router (`src/app/[locale]/*`) |
| Data | TanStack Query v5 → `src/mocks/api.ts` seam (all mocked) | SWR + socket.io → **real** `/api/*` routes |
| Styling | shadcn/ui + Radix + **Tailwind v4** (OKLCH, `src/styles.css`) | shadcn/base-ui + oklch tokens |
| Auth | mock localStorage role-switch | **Linux PAM** (cortexos-admin/sudo), cookie + `src/proxy.ts` |
| Runtime | static SPA / Cloudflare Workers | **native systemd service** (root, port 3080) |
| Pkg mgr | bun | pnpm |
| Tests | Vitest + Testing Library (17 test files) | Vitest (89 files / 620 tests passing) |

**RECOMMENDED STRATEGY (get user sign-off first): port the design INTO the existing Next.js app.**
Keep the real backend, PAM auth, socket.io, audited root-helper, migrations, and the 30 real `/api/*`
routes — sys-pilot only *mocks* all of that. Treat sys-pilot as the visual + UX + component + feature
blueprint. Do NOT replace Next.js with TanStack Start (that throws away the entire working
backend/security layer). Do NOT just run the Lovable app as-is for production (no real host access,
no PAM, no auditing).

---

## 1. Production dashboard state (work already done this session, tests green)

Plan: `~/.claude/plans/now-lets-work-on-kind-sundae.md`. Memory: `[[dashboard-revamp-progress]]`,
`[[tool-channel-wedges-this-env]]`. Baseline: **89 test files / 620 tests pass**.

- **Phase 0 done:** hygiene — `vitest.config.ts` + `.gitignore` exclude `._*`/`.DS_Store`; deleted 498
  AppleDouble files (caused phantom vitest failures).
- **Phase 1 done (backend correctness/security):**
  - `/api/terminal` POST+GET now `requireAdmin` (was authenticated-priv-esc: the `src/proxy.ts` gate
    checks session validity, NOT admin, so any logged-in user could open a root host shell).
  - `admin/services` PATCH `url`→`open_url` (edit silently dropped).
  - `ServiceCheck.url`→`open_url` in `src/hooks/use-dashboard-data.ts` (type lied vs payload).
  - `services` PATCH `icon_image` now `await saveImage` (was storing a Promise).
  - `checkTcp` NaN/port-range guard.
  - `socket-server.ts` `fetchInternal` forwards `x-cortex-internal-token` (proxy gate was 401-ing
    cookieless internal fetches → socket broadcasts silently dead).
- **Phase 2 done:** offline diagnosis + `migrations/004_reconcile_health.sql` (+ rollback). Real cause
  = services bound to the host Tailscale interface not 127.0.0.1: caddy/webmin→systemd,
  prometheus/kernel-browser→docker, cockpit→`systemd cockpit.socket`, hermes-dashboard→inactive.
  **Migration not yet applied live** (runs on next migrate/restart).
- **Phase 3 done:** vendored `public/icons/9router.svg` + 8 core marks (obot, honcho, hermes, gastown,
  mail-guardian, cortex-sandbox-runner, kernel-browser, dockhand) into `VENDORED_SVGS` in
  `src/components/tech-icon.tsx`.
- **Original Phases 4–8 (widgets, sidebar, ⌘K, polish, tests) are now SUBSUMED by this redesign** — do
  them by porting sys-pilot instead of hand-building.

**Nothing committed this session** (standing user rule). The Session-2 Incus provisioning feature is
also delivered-but-uncommitted — do not clobber it.

---

## 2. sys-pilot, fully mapped (audited from the clone)

Stack: TanStack Start v1 · React 19 · Vite 7 · TanStack Query v5 · TanStack Router · shadcn/ui +
Radix · Tailwind v4 (OKLCH `src/styles.css`) · Recharts · xterm.js + `@xterm/addon-fit` ·
react-grid-layout · react-hook-form + zod · cmdk · sonner (toasts) · vaul (drawers) · date-fns ·
Vitest + Testing Library. ~12.7k LOC, 17 test files. bun.

```
src/
  app/        AppShell.tsx, Sidebar.tsx, TopBar.tsx, CommandPalette.tsx (cmdk),
              MobileTabBar.tsx, SimulateMenu.tsx (outage simulator), NavConfig.ts
  components/ AdminOnly, AreaTrend, CodeBlock, ConfirmDialog, CopyButton, DataTable(+test),
              DemoTour, DetailDrawer, DiffViewer(+test), EmptyState(+test), GaugeRadial,
              IncidentTimeline, IncidentToaster, KeyValueList, KeyboardShortcuts, LogStream,
              LogViewer, MetricCard(+test), NetworkTopology, PageHeader, Sparkline(+test),
              StatusBadge(+test), StatusHero, TechIcon, TimeRangeAreaTrend, skeletons/
    ui/         46 shadcn primitives (do not test directly)
  features/   Overview, Apps, Healthcheck, Agents, Docker, Incus, Systemd, Storage, Network,
              Processes, Terminal, MailGuardian, Alerts, Approvals, Audit  (one per page)
    overview/   widgets.tsx (WIDGETS catalog of 17 + DEFAULT_LAYOUT for react-grid-layout)
    admin/      Account, Alerts, Audit, Badges, Docker, EnvBrowser, Incus, Projects, Services,
                Systemd, Users
  hooks/      useAuth, useUI, useT, useFavorites, useHotkey, useKeyboardShortcuts, useLocalStorage,
              useSavedFilters, use-mobile  (+ tests)
  i18n/       en.ts, es.ts, ptBR.ts, index.ts (English-complete; es/ptBR mirror English)
  lib/        format, fuzzy, status (pure, unit-tested), utils, config.server, error-capture
  mocks/      types.ts, seed.ts (376 LOC static), drift.ts (3s live ticker), api.ts (BACKEND SEAM)
  routes/     37 file-based routes (NEVER edit routeTree.gen.ts)
  styles.css  Tailwind v4 + OKLCH tokens (light + .dark + [data-accent] presets + elev shadows)
  test/       Vitest setup + render helpers
```

**Routes / pages to reproduce** (note routes beyond the earlier Lovable spec — these are NEW):
`/login`, `/overview`, `/apps`, `/healthcheck`, `/agents`, `/docker`, `/docker/:id` (detail),
`/incus`, `/incus/:name` (detail), `/systemd`, `/systemd/:unit` (detail), `/storage`, `/network`,
`/processes`, `/terminal`, `/mail-guardian`, `/alerts`, `/approvals`, `/audit`,
**`/backups` (NEW)**, **`/scheduler` (NEW)**, and admin: `/admin/services`, `/admin/users`,
`/admin/badges`, `/admin/env-browser`, `/admin/systemd`, `/admin/docker`, `/admin/incus`,
`/admin/alerts`, `/admin/audit`, `/admin/projects`, `/admin/account`.

**Data seam:** every page uses `useQuery` → `src/mocks/api.ts`. `mocks/drift.ts` `live.start(qc)`
mutates CPU/mem/processes/network/sensors every 3s and randomly flips a service → fires incidents
into alert history. To go live, each `api.*` fn becomes a `fetch('/api/...')`; no page changes.

---

## 3. NEW features sys-pilot introduces (the "new features this design created")

Port all of these — they are why the redesign exists:
1. **`/backups` page (NEW)** — backup jobs/snapshots list, status, size, last-run, restore action.
2. **`/scheduler` page (NEW)** — cron/scheduled-jobs view (next-run, last-run, enable toggle, run-now).
3. **Detail routes:** `/docker/:id`, `/systemd/:unit`, `/incus/:name` — full per-resource detail pages
   (logs, metrics, env, config, devices) rather than only drawers.
4. **Outage simulator** (`SimulateMenu.tsx`) — dev tool to force service flips / incidents (demo only;
   in prod gate behind a dev flag, never wire to real mutations).
5. **Demo tour** (`DemoTour.tsx`) + **keyboard-shortcut overlay** (`?` opens it).
6. **Incident system:** `IncidentTimeline` + `IncidentToaster` (live toast on state change via sonner).
7. **Network topology** view (`NetworkTopology.tsx`) on the Network page.
8. **Diff viewer** (`DiffViewer.tsx`) + **CodeBlock** + **LogStream** (live-tailing log component).
9. **GaugeRadial / AreaTrend / TimeRangeAreaTrend / Sparkline / MetricCard / StatusHero** chart kit.
10. **17-widget react-grid-layout Overview** with true drag+resize+persisted positions (richer than
    the current `@dnd-kit` row/column model). Widget catalog (id → grid default):
    `cpu`(2×2), `memory`(2×2), `storage`(2×2), `cpu-temp`(2×2), `svc-on`(2×2), `svc-off`(2×2),
    `live`(8×5 CPU+mem AreaTrend), `sensors`(4×5 GaugeRadial+fans+volts), `processes`(8×5),
    `network`(4×5), `uptime`(3×2), `docker`(3×2), `incus`(3×2), `alerts`(4×5), `db`(4×4 Databases),
    `mon`(4×4 Monitoring), `drives`(12×4 Drives&Mounts).
11. **Density control** (compact/comfortable) in `useUI`, plus theme (light/dark/system) × 4 OKLCH
    accent presets (cortex/teal/emerald/amber) and locale.
12. **Saved filters** (`useSavedFilters`) on tables.
13. **Component library** to adopt as the new design-system baseline: DataTable (sort/filter/
    paginate/saved-filters), DetailDrawer, LogViewer/LogStream, MetricCard, GaugeRadial, Sparkline,
    AreaTrend, ConfirmDialog, EmptyState, ErrorState, PageHeader, KeyValueList, CodeBlock, DiffViewer,
    StatusBadge, StatusHero, TechIcon, IncidentTimeline, NetworkTopology, AdminOnly (RBAC wrapper).
14. **Accessibility baseline:** skip-to-content, one `<main>` per page, `jsx-a11y` lint gate,
    focus-visible, ≥44px mobile tap targets, `?` shortcut overlay.

---

## 4. Exact data contracts (from sys-pilot `src/mocks/types.ts`)

These are the shapes the design's components expect. Map them to the real API (§5). Notably sys-pilot's
own `ServiceCheck` already uses `open_url` (matches the prod fix from Phase 1).

```ts
ServiceStatus = "online" | "offline" | "unknown";   CheckStatus = ServiceStatus | "checking";
ServiceCheck { id, slug, name, open_url, category, status:ServiceStatus, responseTime,
  icon_color:string|null, icon_image:string|null }
Service extends ServiceCheck { kind:"app"|"service"|"docker"|"process", health_url,
  health_type:"http"|"tcp"|"docker"|"systemd"|"process", description:string|null, env_source:string|null,
  is_active, has_webui, show_in_healthcheck, show_in_webui, sort_order, icon_type, badges:BadgeRef[] }
BadgeRef { slug, label, color }
MachineSensor { id, label, value, unit:"celsius"|"rpm"|"volts", source }
DriveInfo { name, model, size, type?, mount?, used?, total?, percent? }
MountInfo { filesystem, mount, total, used, free, percent }
SystemData { cpu, memory:{percent,used,total}, drives:DriveInfo[], mounts:MountInfo[], load:number[],
  uptime, sensors:{ cpuTemperature:MachineSensor|null, temperatures[], fans[], voltages[] } }
ProcessInfo { pid, user, command, cpu, mem }
NetworkInterface { name, rxKbps, txKbps, rxBytesTotal, txBytesTotal };  NetworkData { interfaces[] }
DockerContainer { id, name, image, status, state:"running"|"exited"|"paused"|"restarting", ports, created }
DockerImage { id, repo, tag, size, created };  DockerVolume { name, driver, mountpoint, size }
IncusInstance { name, slug, status:"draft"|"validated"|"provisioning"|"active"|"failed",
  type:"container"|"vm", image, cpu, memory, config:Record<string,string>,
  devices:Record<string,Record<string,string>>, last_validation:{ok,ran_at,notes}|null, created_at }
SystemdUnit { name, description, load, active:"active"|"inactive"|"failed", sub, enabled }
AlertRule { id, name, service_id, condition:"offline"|"online"|"response_time", threshold_ms:number|null, enabled }
AlertHistory { id, ruleName, serviceName, status:"fired"|"resolved"|"info", message, timestamp }
ApprovalRequest { id, actor, tool, summary, args_preview, requested_at, status:"pending"|"approved"|"denied", reason? }
AuditEntry { id, actor, tool, tool_class, args_hash, decision:"allow"|"deny", decision_reason, result, created_at }
Badge { slug, label, color, text_color };  PamUser { username, uid, groups[], is_admin }
Project { slug, name, description, repo_url, branch, created_at }
Agent { slug, name, description, files:{path,language,content}[] }
MailReview { id, from, subject, snippet, body, risk:"low"|"medium"|"high",
  status:"pending"|"approved"|"flagged", received_at }
```

Seed catalog (sys-pilot `seed.ts`, ~29 services across AI / Infrastructure / Database / Media /
Monitoring) matches the prod catalog: 9router, ollama, honcho, honcho-mcp, obot, kernel-browser,
cortex-sandbox-runner, caddy, tailscale, cockpit, webmin, incus, dockhand, watchtower, dnsmasq,
fail2ban, postgresql, mysql, redis, mongodb, pgadmin, phpmyadmin, redisinsight, jellyfin, grafana,
prometheus, loki, cadvisor, home-assistant. Badge catalog identical to prod
(ai/app/db/api/system/monitoring/media/infra/network/storage/agent/project).

---

## 5. Contract mapping (sys-pilot → real API) — do this in a thin adapter, don't bend the backend

- **Service**: aligned (`open_url`). Real admin superset already matches. Real status enum is
  online/offline/unknown (no `degraded` in prod — only add if you also add a `checkService` rule).
- **Backups / Scheduler**: NO real endpoints or tables exist. New backend work required — see §6/Phase D.
  (Note: host backups already exist on NAS per the ops runbook; a real `/api/backups` could read those.)
- **Incus**: real `incus_instances` table differs (status draft/validated/provisioning/active/failed,
  config jsonb, last_validation). Map for display; keep the real provisioning wizard/lifecycle.
- **Systemd/Process/Network/Storage**: field names match closely (network uses rxKbps/txKbps in both).
- **Auth/roles**: KEEP prod PAM (`is_admin` via cortexos-admin/sudo) as the security boundary. Use
  sys-pilot's `AdminOnly` wrapper for UI gating only; never weaken the server `requireAdmin` gate.
- **Approvals / Mail Guardian / Agents detail / Projects-as-page**: real surfaces are partial — wire to
  existing routes where present (audit, mail-guardian, projects admin) and add endpoints where missing.

---

## 6. Execution plan (phased; keep `pnpm test` green at every step; feature branch)

**Phase A — Tokens & primitives.** Port sys-pilot `src/styles.css` OKLCH tokens (incl. `[data-accent]`
presets, `--shadow-elev1/2`, sidebar.* and chart-1..5) into the prod token file; reconcile with the
existing brand presets. Port shared components (DataTable, DetailDrawer, LogViewer/LogStream,
MetricCard, GaugeRadial, Sparkline, AreaTrend, ConfirmDialog, EmptyState, ErrorState, PageHeader,
KeyValueList, CodeBlock, DiffViewer, StatusBadge, StatusHero, TechIcon[merge with Phase-3 icons],
IncidentTimeline/Toaster, NetworkTopology, AdminOnly). Add `"use client"` where they use hooks.
**Biggest mechanical risk: Tailwind version.** sys-pilot is Tailwind v4; confirm prod's version and
reconcile config before mass-porting.

**Phase B — Shell.** Port AppShell/Sidebar/TopBar/CommandPalette(cmdk)/MobileTabBar + NavConfig into
`src/app/[locale]/layout.tsx` + `src/components/layout/*`. ONE nav source of truth (prod
`nav-config.ts`), aligned to sys-pilot's sections (Projects top-level; Administration group; add
Backups + Scheduler). Wire ⌘K to real audited actions. Add `?` overlay + skip-to-content + DemoTour.

**Phase C — Pages (one at a time).** For each route in §2, port the sys-pilot `features/*` visual into
the matching Next page, swapping `useQuery(api.*)` for the real SWR/socket hooks +`/api/*`. Order:
Overview → Apps → Healthcheck → Docker(+/:id) → Incus(+/:name) → Systemd(+/:unit) → Storage → Network
→ Processes → Terminal(keep real root-helper, adopt xterm UI) → Mail Guardian → Alerts → Approvals →
Audit → Agents(+detail) → Projects → Backups → Scheduler → all admin/*.

**Phase D — New backend surfaces.** Add real endpoints + migrations (idempotent; runner records by
filename; rollbacks in `migrations/rollback/`) for: Backups, Scheduler, Approvals queue, Mail Guardian
risk levels, Agents detail (tokens/requests). Wire the Overview `live`/`sensors` widgets to the real
`/api/system` sensor backend.

**Phase E — i18n.** Merge sys-pilot en/es/ptBR keys into prod `messages/{en,es,pt-br}.json`; add a key-
parity test (all three locales have identical key sets).

**Phase F — Verify.** `pnpm test` green + `./node_modules/.bin/next build` clean (`sudo rm -rf .next`
first if root-owned → misleading EACCES). Separate verifier/code-reviewer pass (no self-approval).
Manual E2E each page in all 3 locales, app-up and a service forced-down.

---

## 7. Hard constraints (every phase)

- Never commit/print secrets, tokens, keys, private IPs; secrets stay under `/opt/cortexos/.secrets`
  (reference by path only; never in seed/DB).
- All package ops via `scripts/pkg.sh`; never raw `apt`. Ubuntu/Debian only.
- Do NOT commit/push unless the user explicitly asks. If asked: `/opt/cortexos` `.git` is root-owned →
  `sudo git -c safe.directory=/opt/cortexos -c user.name="Heitor Ramon Ribeiro"
  -c user.email="heitor.ramon@gmail.com"`; branch is `main`. Don't clobber the uncommitted Session-2
  Incus feature.
- Mutating ⌘K/admin/SimulateMenu actions go through existing audited endpoints (`executeRootCommand` +
  `requireAdmin` + `createActionLog`). No new shell command strings in TS; argv as vectors. The outage
  simulator must be demo-only/dev-flagged in prod — never wired to real host mutations.
- Keep BOTH the `src/proxy.ts` session gate AND per-route `requireAdmin` (Phase 1 proved the gate
  alone is not an admin boundary).
- Authoring and review are separate passes; verify with `verifier`/`code-reviewer` before claiming done.
- Migrations: idempotent `UPDATE/INSERT ... WHERE/ON CONFLICT`; runner (`src/lib/db/migrate.ts`)
  records by filename and skips applied; rollbacks in `migrations/rollback/` (not auto-scanned); do NOT
  self-record inside a migration the runner will run (UNIQUE clash).
- Gate = `cd packages/dashboard && pnpm test` (0 real failures) + clean `next build`.

## 8. Environment gotchas

- The Bash/Read tool channel in this workspace intermittently returns empty then flushes a turn later
  ([[tool-channel-wedges-this-env]]). Don't retry-hammer; write long output to `/tmp/*.txt` and read it;
  run tests/builds with `run_in_background` (completion notifications are reliable).
- Reference clone of the design: `/tmp/sys-pilot` (re-clone with
  `git clone --depth 1 https://github.com/bloodf/sys-pilot` if gone).
- The earlier full Lovable build prompt lives at `docs/LOVABLE-PROMPT.md` (the spec that generated
  sys-pilot) — useful cross-reference.

## 9. First actions for the next session

1. Re-clone sys-pilot; read `ARCHITECTURE.md`, `src/styles.css`, `src/app/*`, `src/components/*`,
   `src/mocks/types.ts`, `src/features/overview/widgets.tsx`.
2. **Get explicit user sign-off on the strategy** (port-into-Next [recommended] vs adopt-TanStack vs
   greenfield). This is a real fork; do not start mass changes without it.
3. Start Phase A (tokens + primitives) on a feature branch. Keep `pnpm test` green at every step.
4. Track with TaskCreate (Phases A–F). Commit only when the user asks.
