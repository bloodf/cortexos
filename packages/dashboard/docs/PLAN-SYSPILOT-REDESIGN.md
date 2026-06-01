# Plan: sys-pilot Redesign Implementation

## Strategy
Port sys-pilot's design, UX, components, and NEW features INTO the existing Next.js 16 production dashboard. Keep all real backend, PAM auth, socket.io, audited root-helper, migrations, and 30 /api/* routes.

## State Baseline
- Production dashboard at `/opt/cortexos/packages/dashboard`
- Framework: Next.js 16 (App Router, Turbopack), Tailwind v4, shadcn/ui + base-ui
- Tests: Vitest + Testing Library (89 test files)
- Uncommitted Session-2 Incus feature exists (must preserve)
- sys-pilot reference clone at `/home/cortexos/Developer/github/bloodf/sys-pilot-analysis`

## Phase A: Foundation (Tokens, Primitives, Components)

### A1. Token System Reconciliation
- Port sys-pilot OKLCH tokens from `src/styles.css` into prod `src/app/globals.css`
- Add `[data-accent]` presets (cortex/teal/emerald/amber)
- Add `--shadow-elev1/2/3`, sidebar.* tokens, chart-1..5
- Preserve existing brand presets, merge don't replace
- Add density tokens (compact/comfortable)

### A2. Component Library Port
Port these sys-pilot components into `src/components/` (add "use client" where needed):
- **Data** — DataTable (+ sort/filter/paginate/saved-filters), DetailDrawer, EmptyState, ErrorState, PageHeader, KeyValueList, ConfirmDialog
- **Display** — MetricCard, GaugeRadial, Sparkline, AreaTrend, TimeRangeAreaTrend, StatusBadge, StatusHero, TechIcon (merge with existing)
- **Logs** — LogViewer, LogStream, CodeBlock, DiffViewer
- **Network** — NetworkTopology
- **Incidents** — IncidentTimeline, IncidentToaster
- **Auth** — AdminOnly (RBAC wrapper, UI-only)
- **Skeletons** — TableSkeleton, ChartSkeleton, CardSkeleton (match final layout)

### A3. Hooks Port
- useUI (theme/accent/density/locale) — merge with existing use-theme
- useAuth — adapt to prod PAM (keep mock for tests)
- useFavorites, useHotkey, useKeyboardShortcuts, useSavedFilters
- useLocalStorage (already exists, reconcile)
- use-mobile (responsive breakpoint hook)

### A4. Utilities
- Port `src/lib/format.ts`, `fuzzy.ts`, `status.ts` (pure, unit-test)

## Phase B: Shell & Navigation

### B1. AppShell / Layout
- Port AppShell.tsx structure into `src/app/[locale]/layout.tsx`
- Sidebar: icon-rail collapse, persisted state, scrollable groups
- TopBar: breadcrumb, global search trigger, notifications bell, user menu
- MobileTabBar: bottom nav on mobile
- Skip-to-content link, one `<main>` per page

### B2. Command Palette
- Port cmdk-based CommandPalette.tsx
- Wire to real audited actions (through existing endpoints)
- Fuzzy nav + executable actions (theme, accent, role switch)
- Gate dev-only actions (outage simulator) behind dev flag

### B3. Navigation Config
- Merge sys-pilot NavConfig with prod `nav-config.ts`
- Add Backups + Scheduler top-level routes
- Add Projects top-level
- Administration group: Services, Users, Badges, Env Browser, Systemd, Docker, Incus, Alerts, Projects, Audit, Account

### B4. Keyboard Shortcuts + Demo Tour
- `?` overlay (KeyboardShortcuts component)
- DemoTour component (first-run guided tour)

## Phase C: Pages (port one at a time, keep tests green)

Order: Overview → Apps → Healthcheck → Docker(+/:id) → Incus(+/:name) → Systemd(+/:unit) → Storage → Network → Processes → Terminal → Mail Guardian → Alerts → Approvals → Audit → Agents(+detail) → Projects → Backups → Scheduler → admin/*

For each page:
1. Port visual layout from sys-pilot `features/*`
2. Swap `useQuery(api.*)` for prod SWR/socket hooks + `/api/*`
3. Wire to real data contracts (§5 mapping)
4. Add/reuse loading skeletons
5. Run tests, fix failures

### C1. Overview (highest priority)
- 17-widget react-grid-layout (replace @dnd-kit)
- Widget catalog: cpu(2×2), memory(2×2), storage(2×2), cpu-temp(2×2), svc-on(2×2), svc-off(2×2), live(8×5), sensors(4×5), processes(8×5), network(4×5), uptime(3×2), docker(3×2), incus(3×2), alerts(4×5), db(4×4), mon(4×4), drives(12×4)
- Persisted layout to localStorage
- Live drift for demo (optional, dev-flagged)

### C2. Detail Routes (NEW)
- `/docker/:id` — logs, metrics, env, config
- `/systemd/:unit` — logs, status, enable/disable
- `/incus/:name` — detail page (merge with existing provision work)

### C3. Backups Page (NEW)
- Backup jobs/snapshots list, status, size, last-run
- Restore action (mocked until real backend)

### C4. Scheduler Page (NEW)
- Cron/scheduled-jobs view
- Next-run, last-run, enable toggle, run-now

## Phase D: New Backend Surfaces

### D1. Backups API
- `GET /api/backups` — list backup jobs
- `POST /api/backups/:id/restore` — trigger restore
- Migration: `028_backups.sql`

### D2. Scheduler API
- `GET /api/scheduler` — list cron jobs
- `PATCH /api/scheduler/:id` — enable/disable
- `POST /api/scheduler/:id/run` — run now
- Migration: `029_scheduler.sql`

### D3. Sensors API
- Extend `/api/system` with sensor readings
- CPU temp, fans, voltages

### D4. Approvals Queue API
- Extend existing approvals with queue status

## Phase E: i18n

- Merge sys-pilot en/es/ptBR keys into prod `messages/{en,es,pt-br}.json`
- Add key-parity test (all locales identical key sets)
- Keep existing next-intl setup

## Phase F: Verify & Deploy

1. `pnpm test` — 0 real failures
2. `pnpm run build` — clean
3. Manual E2E each page in all 3 locales
4. Test app-up and forced-down service
5. Commit to feature branch
6. Merge to main, push
7. Deploy: `docker compose up -d --build`

## Hard Constraints
- Never commit secrets
- All package ops via `scripts/pkg.sh`
- Do NOT commit unless explicitly asked (handoff rule — but user asked for full autonomous commit/push)
- Mutating actions through audited endpoints only
- Keep `src/proxy.ts` session gate AND per-route `requireAdmin`
- Migrations idempotent, rollbacks in `migrations/rollback/`
- Preserve uncommitted Session-2 Incus feature
