# sys-pilot Template Inventory

> **M0-B Workstream B deliverable** — exhaustive inventory of the `sys-pilot` dashboard template as vendored in `cortexos`.
>
> **Author:** Ada Lovelace (TS React/Svelte Engineer) · **Worktree:** `.worktrees/m0-b-template-audit` on branch `feature/m0-b-template-audit`
>
> **Generated:** 2026-06-02 · **Status:** `pending` (M1/M2 will fill in target state)

---

## 0. Source-of-truth provenance

The task brief directs the audit to clone `https://github.com/bloodf/sys-pilot.git` and treat that as the source of truth. Two findings:

1. **The upstream `github.com/bloodf/sys-pilot` repository is no longer publicly accessible** (`git clone` returns `Repository not found`; `gh repo list bloodf` does not include it). It is either renamed, deleted, or made private.
2. **The entire sys-pilot template is already vendored** inside the cortexos repo at:
   - `packages/dashboard/src/app/sys-pilot/` (6 files — application shell)
   - `packages/dashboard/src/components/sys-pilot/` (28 files — presentational primitives + 4 sub-component modules: `admin/`, `agents/`, `auth/`, `incus/`, `overview/`)
   - `packages/dashboard/src/lib/sys-pilot/` (3 files — shared types, status helpers, formatters)

> **Decision:** The vendored copy IS the source of truth. Every file in those three directories plus every consuming page/component/hook is in scope. No assumption is made that an upstream version exists or is reachable.
>
> **The `sys-pilot/` is no longer a pure mock — it is the live CortexOS dashboard UI.** `src/lib/api.ts` (under `src/lib/`, not under `sys-pilot/`) is the real HTTP client. The only "mock" elements that remain are:
> - `DetailDrawer.MockLogs` / `MockMetrics` / `MockEnv` (synthesize fake logs/metrics/env values for the docker container drawer)
> - `LogStream.tsx` (client-side stream simulator for the Healthcheck page)
> - `IncidentToaster.tsx` carries a stale comment about a "drift simulator" — the actual implementation polls the real `/api/alerts?history=1` endpoint.

The app is on **Next.js 16.2.6 + React 19.2.4 + TanStack Query 5 + zod 4** (see `packages/dashboard/package.json`).

---

## 1. Nav architecture (canonical)

There are **two** nav definitions. They agree on routes; the one in `src/app/sys-pilot/NavConfig.ts` is a **legacy, narrower list** and the one in `src/components/layout/nav-config.ts` is the **canonical, used-at-runtime list**. The sidebar in `src/app/sys-pilot/Sidebar.tsx` reads `NAV_GROUPS` from `src/components/layout/nav-config.ts` (NOT from its sibling). The mobile tab bar and the command palette also use the canonical `NAV_GROUPS`.

The canonical nav groups (`src/components/layout/nav-config.ts`):

| Group | Items (href → label → icon) | Admin? |
|---|---|---|
| **Platform** | `/overview` Overview (Activity), `/apps` Apps (LayoutGrid), `/healthcheck` Healthcheck (HeartPulse), `/agents` Agents (Bot), `/hermes` Hermes (Sparkles) | no |
| **Infrastructure** | `/docker` Docker (Container), `/incus` Incus (Boxes), `/systemd` Systemd (Server), `/storage` Storage (HardDrive), `/network` Network (Network), `/processes` Processes (Cpu), `/terminal` Terminal (Terminal), `/backups` Backups (Archive), `/scheduler` Scheduler (Calendar) | no |
| **Security & Ops** | `/mail-guardian` Mail Guardian (Mail), `/alerts` Alerts (Bell), `/approvals` Approvals (CheckCircle2), `/audit` Audit (ScrollText) | no |
| **Admin** | `/admin/services` Services, `/admin/badges` Badges, `/admin/env-browser` Env Browser, `/admin/systemd` Systemd, `/admin/docker` Docker, `/admin/alerts` Alerts, `/admin/users` Users, `/admin/projects` Projects, `/admin/incus` Incus, `/admin/audit` Audit Log, `/admin/account` Account | no (gated by `user.is_admin` in `Sidebar.tsx`) |

> **Note:** `/hermes` is in the canonical nav but **no `src/app/[locale]/hermes/` page exists** at the time of audit. This is a placeholder route referenced from the nav.

The **legacy sys-pilot `NavConfig.ts`** lists 23 items in 4 groups (`platform`, `infra`, `secOps`, `admin`) — same routes minus `hermes`, `backups`, `scheduler`, plus a `MOBILE_TABS` constant. The MobileTabBar in `src/app/sys-pilot/MobileTabBar.tsx` **does** define its own 5-item mobile tab array (Overview, Docker, Incus, Systemd, Admin → Services). The two mobile arrays differ; the runtime one is `MobileTabBar.tsx` (its own array) since it's the rendered component.

---

## 2. Routes / pages (with template file path)

All routes live under `src/app/[locale]/`. Every page is a React Server Component unless noted (`"use client"`).

### 2.1 Auth

| Route | File | Component type | Uses sys-pilot | Notes |
|---|---|---|---|---|
| `/{locale}/login` | `app/[locale]/login/page.tsx` | server | `LoginForm` from `components/sys-pilot/auth/login-form.tsx` | `metadata: title="Login"`, `dynamic = "force-dynamic"`. UI: Shield icon, glass panel, `LoginForm` (username + password, POSTs to `/api/auth`, on success `router.push("/admin"); router.refresh()`). |
| `/{locale}/setup` | `app/[locale]/setup/page.tsx` | server | — | Hard-redirects to `/login`. Comment explains PAM auth replaces DB-seeded admin. |

### 2.2 Root redirects

| Route | File | Behavior |
|---|---|---|
| `/[locale]` | `app/[locale]/page.tsx` | `redirect("/[locale]/overview")` |
| `/{locale}/dashboard` | `app/[locale]/dashboard/page.tsx` | `redirect("/[locale]/overview")` |
| `/{locale}/process` | `app/[locale]/process/page.tsx` | `redirect("/[locale]/processes")` |
| `/{locale}/services` | `app/[locale]/services/page.tsx` | `redirect("/[locale]/healthcheck")` (renamed in v1.0 plan §3) |
| `/{locale}/system` | `app/[locale]/system/page.tsx` | `redirect("/[locale]/storage")` |

### 2.3 Platform pages

| Route | File | Type | sys-pilot components used |
|---|---|---|---|
| `/[locale]/overview` | `app/[locale]/overview/page.tsx` | client | `PageHeader`, `StatusHero`, `WIDGETS/WIDGET_MAP/DEFAULT_LAYOUT` from `components/sys-pilot/overview/widgets.tsx`. Uses `react-grid-layout/legacy` (RGL) for drag-resize. Layout persisted in `localStorage` under `cortex.overview.layout.v1`. Edit mode toggle. "Add widget" popover (lists `available = WIDGETS.filter(w => !usedIds.has(w.id))`). "Reset" button. Responsive breakpoints: `lg:1200, md:996, sm:768, xs:480, xxs:0`, cols `12/12/6/4/2`, rowHeight 56, margin [12,12]. |
| `/[locale]/apps` | `app/[locale]/apps/page.tsx` | client | `PageHeader`, `TechIcon`, `StatusBadge`, `EmptyState`. Filter UI: search box (filters name/slug/description), category chips, status filter (`all/online/offline`), view toggle (grid/list). `useFavorites()` separates results into Favorites + All apps sections. |
| `/[locale]/healthcheck` | `app/[locale]/healthcheck/page.tsx` | client | `PageHeader`, `StatusBadge`, `TechIcon`, `DataTable` (cols: Service, Category, Status, Latency, Type, recheck action), `LogStream`. Period segmented control: `1h / 24h / 7d` (cosmetic — table doesn't filter by period). Also renders an inline incident timeline (custom, not `IncidentTimeline` component) and a `<LogStream height={360} />`. |
| `/[locale]/agents` | `app/[locale]/agents/page.tsx` | client | `PageHeader`, `TechIcon`, `CodeBlock`. 3-column layout: agent list (left), file tree (mid), code viewer (right). Uses `useQuery(["agents"], api.agents)` which flattens `groups[*].agents[*]` from `/api/agents`. |
| `/[locale]/agents/[slug]` | `app/[locale]/agents/[slug]/page.tsx` | server | `PageHeader`, `AgentFileViewer` from `app/[locale]/agents/[slug]/agent-file-viewer.tsx` (and from `components/sys-pilot/agents/agent-file-viewer.tsx` — same name, different files; this server one delegates to client). Uses `scanAgents()` from `@/lib/agents/scanner`. |

### 2.4 Infrastructure pages

| Route | File | Type | sys-pilot components | Notes |
|---|---|---|---|---|
| `/[locale]/docker` | `app/[locale]/docker/page.tsx` | client | `PageHeader`, `DataTable` (containers/images/volumes tabs), `ConfirmDialog`, `DetailDrawer` (with `MockLogs`, `MockMetrics`, `MockEnv` tabs). Tabs: Containers, Images, Volumes. Per-row actions: Logs, Start/Stop (admin), Restart, Remove (ConfirmDialog with `requireText=name`). | Inline `_SAMPLE_LOGS` constant exists but is **unused** (likely legacy — `MockLogs` is what renders). |
| `/[locale]/docker/[id]` | `app/[locale]/docker/[id]/page.tsx` | client | `PageHeader`, `KeyValueList`. Tabs: Overview (key-value list of container fields), Logs (placeholder card — "no log endpoint is exposed"). Start/Stop/Restart call `POST /api/docker/actions` (real backend). | Admin-only actions. |
| `/[locale]/incus` | `app/[locale]/incus/page.tsx` | client | `PageHeader`, `DataTable` (name/type/image/cpu/memory/status/act), `KeyValueList`, `CodeBlock` (renders config + devices as YAML), local inline `ProvisionWizard` (5-step). Sheet drawer for instance detail. Status colors: active=success, provisioning=warning, validated=primary, draft=muted, failed=destructive. | Two separate wizards exist: an inline local one in `incus/page.tsx` (simulated, instantiates on success), and a richer one in `components/sys-pilot/incus/provision-wizard.tsx` used at `/incus/provision`. |
| `/[locale]/incus/[name]` | `app/[locale]/incus/[name]/page.tsx` | client | `PageHeader`, `KeyValueList`, `CodeBlock` (config, validation, live info as JSON). Admin actions: Start/Stop/Restart/Delete call `POST /api/incus/actions` (with `x-incus-delete-confirm: true` header for delete). Shell panel (admin only) calls `POST /api/incus/{name}/shell` and renders stdout/stderr in `CodeBlock`. Live status polled every 5s via `/api/incus/{name}`. | Disabled (admin) shell when instance is not running. |
| `/[locale]/incus/provision` | `app/[locale]/incus/provision/page.tsx` | server | `PageHeader`, `ProvisionWizard` (rich version from `components/sys-pilot/incus/provision-wizard.tsx`). | 5-step wizard: Target, Image, Hermes, Network, Review. Uses Zod schema from `@/lib/incus/config-schema`. Real flow: `POST /api/incus/instances` → `POST /validate` → `POST /provision` with status polling every 2s. |
| `/[locale]/systemd` | `app/[locale]/systemd/page.tsx` | client | `PageHeader`, `DataTable` (name/desc/load/active/sub/enabled/act). Start/Stop/Restart are **client-state optimistic** (`setQueryData` updates `sub: "running" | "dead"`); Enable/Disable Switch also client-state only. Real backend `POST /api/systemd/actions` exists but is NOT called here. | Reads `/api/systemd` (real). |
| `/[locale]/systemd/[unit]` | `app/[locale]/systemd/[unit]/page.tsx` | client | `PageHeader`. Detail card with name/description/load/active/sub/enabled. **Does** call real `POST /api/systemd/actions` for start/stop/restart. | Admin-only. |
| `/[locale]/storage` | `app/[locale]/storage/page.tsx` | client | `PageHeader`, `DataTable` (drives table), `Card` with mountpoint usage bars (uses `usageBg` from `lib/sys-pilot/status`). | Polls `/api/system` every 5s for live mounts. |
| `/[locale]/network` | `app/[locale]/network/page.tsx` | client | `PageHeader`, `MetricCard` (Rx/Tx totals), `NetworkTopology` (SVG WAN→Edge→Host→interfaces with pulse animation). 4 metric cards + topology + per-interface detail cards. | Polls `/api/network` every 3s. |
| `/[locale]/processes` | `app/[locale]/processes/page.tsx` | client | `PageHeader`, `DataTable` (pid/user/command/cpu%/mem% with progress bars). `pageSize=50`. | Polls `/api/processes` every 3s. |
| `/[locale]/terminal` | `app/[locale]/terminal/page.tsx` | client | `PageHeader`, `EmptyState` (for 403). Uses `@xterm/xterm` + `@xterm/addon-fit` directly. Real backend protocol: `POST /api/terminal` (connect / exec / disconnect) and SSE `GET /api/terminal?sessionId=...` for output. | Admin-only. Theme-aware colors. ResizeObserver. |
| `/[locale]/backups` | `app/[locale]/backups/page.tsx` | client | `PageHeader`. 4 metric cards (Total/Last/Size) + archive list. | Polls `/api/backups` every 30s. |
| `/[locale]/scheduler` | `app/[locale]/scheduler/page.tsx` | client | `PageHeader`. 4 metric cards (Active timers/Next run) + job list. | Polls `/api/scheduler` every 10s. |

### 2.5 Security & Ops pages

| Route | File | Type | sys-pilot components | Notes |
|---|---|---|---|---|
| `/[locale]/mail-guardian` | `app/[locale]/mail-guardian/page.tsx` | client | `PageHeader`. 2-pane: reviews list (left) + detail + decision buttons (right). Decisions: `keep`, `spam`, `block_sender`, `allow_sender` POSTed to `/api/mail-guardian/reviews`. | Polls every 5s. Verdict color rules: spam/malicious/phish = destructive, suspicious/review = warning, else success. |
| `/[locale]/alerts` | `app/[locale]/alerts/page.tsx` | client | `PageHeader`, `DataTable` (history), `IncidentTimeline`. Tabs: Timeline / History / Rules. Rules tab is read-only (`Switch disabled`). | Polls history every 3s. |
| `/[locale]/approvals` | `app/[locale]/approvals/page.tsx` | client | `PageHeader`. Tabs: Pending / Resolved. Approve POSTs `{id, decision:"approve"}`; Deny opens a dialog with required reason textarea. | Admin-only actions. |
| `/[locale]/audit` | `app/[locale]/audit/page.tsx` | client | `PageHeader`, `DataTable`, `KeyValueList` (in Sheet for row detail). | Polls `/api/audit` every 10s (admin page). |

### 2.6 Admin pages

| Route | File | Type | sys-pilot components | Notes |
|---|---|---|---|---|
| `/[locale]/admin` | `app/[locale]/admin/page.tsx` | server | `AdminDashboard` from `components/sys-pilot/admin/admin-dashboard.tsx` (a small `<Card>{count} services</Card>` placeholder). | Fetches `getAllServicesForAdmin()` server-side, maps to `Service` type. |
| `/[locale]/admin/services` | `app/[locale]/admin/services/page.tsx` | client | `PageHeader`, `TechIcon`, `StatusBadge`, `DataTable`, `ConfirmDialog` (with `requireText=slug`). Add/Edit dialog. | CRUD: GET/POST/PATCH/DELETE `/api/admin/services`. Health type select: `http/tcp/docker/systemd/process`. |
| `/[locale]/admin/badges` | `app/[locale]/admin/badges/page.tsx` | client | `PageHeader`, `DataTable`, `ConfirmDialog`. Add/Edit dialog with color picker. | CRUD: GET/POST/PUT/DELETE `/api/badges`. |
| `/[locale]/admin/env-browser` | `app/[locale]/admin/env-browser/page.tsx` | client | `PageHeader`. Path input, file list (single loaded file), kv list with Eye/EyeOff reveal + Copy buttons. | Backend `GET /api/env-browser?path=...` returns `{path, lines: EnvLine[]}` with `type: "kv"|"comment"|"blank"`. Cleartext reveal needs an `X-Cortex-Confirmation-Token` the UI cannot mint. |
| `/[locale]/admin/systemd` | `app/[locale]/admin/systemd/page.tsx` | client | `PageHeader`, `DataTable`, `ConfirmDialog` (Stop only). Start/Restart bare buttons. | Real `POST /api/systemd/actions`. |
| `/[locale]/admin/docker` | `app/[locale]/admin/docker/page.tsx` | client | `PageHeader`, `DataTable`, `ConfirmDialog` (Remove — but `toast.error("Container removal is not available")` — the confirm is purely UI, the handler is intentionally disabled). | Real `POST /api/docker/actions` for start/stop/restart. |
| `/[locale]/admin/alerts` | `app/[locale]/admin/alerts/page.tsx` | client | `PageHeader`, `DataTable`, `ConfirmDialog`. Create rule dialog (name + service_id + condition + threshold_ms). | Real CRUD on `/api/alerts`. Conditions: `offline/online/response_time`. |
| `/[locale]/admin/users` | `app/[locale]/admin/users/page.tsx` | client | `PageHeader`, `DataTable` (username/last_login/active_sessions/created_at). | Read-only: accounts managed by host PAM. |
| `/[locale]/admin/projects` | `app/[locale]/admin/projects/page.tsx` | client | `PageHeader`, `DataTable`, `ConfirmDialog` (with `requireText=slug`). Create/Edit dialog (slug/name/repo/messaging_mode). | CRUD: GET/POST/PUT/DELETE `/api/projects`. |
| `/[locale]/admin/incus` | `app/[locale]/admin/incus/page.tsx` | client | `PageHeader`, `DataTable`, `ConfirmDialog` (Delete with `requireText=name`). | Real `POST /api/incus/actions`. Polls every 5s. |
| `/[locale]/admin/audit` | `app/[locale]/admin/audit/page.tsx` | client | `PageHeader`, `DataTable`. Export button → builds a JSON Blob and downloads `audit-YYYY-MM-DD.json`. | Polls every 10s. |
| `/[locale]/admin/account` | `app/[locale]/admin/account/page.tsx` | client | `PageHeader`. Cards: Profile / Security (password change POSTs to `/api/auth/password`) / Notifications (3 switches) / Appearance (theme + accent + language). | "Save" on Profile is a toast — not wired to backend. Theme/accent/locale are local-state only. |

### 2.7 Settings

| Route | File | Type | sys-pilot components | Notes |
|---|---|---|---|---|
| `/[locale]/settings` | `app/[locale]/settings/page.tsx` | server | `PageHeader`. Single "Appearance" card with placeholder text. | "Theme settings coming soon." |

### 2.8 Layouts (route segment + root)

| File | Purpose |
|---|---|
| `app/[locale]/layout.tsx` | Root locale layout. Wraps everything in `NextIntlClientProvider`, `DashboardDataProvider`, `AppShell` (the sys-pilot shell), `CommandPalette`, `FavoritesBar`. Sets `metadata.title = "Cortex Dashboard"`, PWA manifest, appleWebApp config. |
| `app/[locale]/<route>/layout.tsx` | Every sub-route has a one-liner `DashboardShell` wrapper from `components/sys-pilot/dashboard-shell.tsx` (currently a passthrough `<>{children}</>`). Detail pages (`/docker/[id]`, `/systemd/[unit]`, `/incus/[name]`) skip DashboardShell. |
| `app/sys-pilot/AppShell.tsx` | The actual shell: `Sidebar` + `TopBar` + main content + `MobileTabBar` + `KeyboardShortcuts` dialog + `IncidentToaster`. Includes skip-to-main-content link. |

---

## 3. Components (`src/components/sys-pilot/`)

38 files total, organized into 4 sub-folders.

### 3.1 Root components

| File | Type | Purpose / Props |
|---|---|---|
| `AppShell.tsx` (in `app/sys-pilot/`) | client | The shell wrapper. `useState<collapsed, mobileOpen, _paletteOpen, helpOpen>`. Renders skip link, Sidebar, TopBar, main, MobileTabBar, KeyboardShortcuts dialog, IncidentToaster. |
| `PageHeader.tsx` | server | `icon?, title, description?, actions?` — title block + action buttons. |
| `dashboard-shell.tsx` | client | Passthrough `<>{children}</>` — used by all per-route layouts. Exists as a hook for future global decoration. |
| `EmptyState.tsx` | server | `icon?, title, description?, action?, className?` — centered empty placeholder. |
| `StatusHero.tsx` | client | Aggregates `/api/services` + `/api/system` → "All systems operational" / "N services offline" / "Elevated load" banner with 3 small stats. |
| `StatusBadge.tsx` | client | `status: Status, responseTime?, compact?` — pill with colored dot + label + ms. |
| `MetricCard.tsx` | server | `label, value, hint?, icon?, trend?, className?` — single KPI card. |
| `Sparkline.tsx` | server | Pure SVG line+area chart, `data: number[], width?, height?, color?, fill?` (defaults 120×36, `--primary`). |
| `AreaTrend.tsx` | server | recharts `<AreaChart>` with gradient fill, `data, series, height?, yDomain?, xKey?`. |
| `GaugeRadial.tsx` | server | SVG radial gauge, `value, max?, size?, label?, sublabel?, thresholds?, className?` (default thresholds `[75, 90]`). |
| `NetworkTopology.tsx` | client | SVG WAN→Edge→Host→interfaces with pulse animation, polls `/api/network` every 3s. |
| `DetailDrawer.tsx` | client | `<Sheet>` wrapper with `<Tabs>` header. **Also exports `MockLogs`, `MockMetrics`, `MockEnv`** — these are inline mock helpers (see §6). `DetailTab[]` prop. |
| `LogStream.tsx` | client | Client-side stream simulator (see §6). |
| `LogViewer.tsx` | client | Auto-following log panel with regex-based line coloring (ERROR=red, WARN=yellow, INFO=green). |
| `CodeBlock.tsx` | server | Dark code block with language label + `CopyButton`. |
| `CopyButton.tsx` | client | Uses `navigator.clipboard.writeText`, swaps to Check icon for 1.2s. |
| `KeyValueList.tsx` | server | `<dl>` grid with monospace value column. |
| `ConfirmDialog.tsx` | client | `<AlertDialog>` with optional `requireText` for type-to-confirm. Destructive variant. |
| `IncidentTimeline.tsx` | server | Vertical timeline of `AlertHistory[]`, sorted desc by `timestamp`. Fired/resolved icons. |
| `IncidentToaster.tsx` | client | Polls `/api/alerts?history=1` every 4s, emits sonner toasts for new entries. **Note: the source comment incorrectly calls this a "drift simulator"; it polls the real backend.** |
| `KeyboardShortcuts.tsx` | server | `<Dialog>` showing the 3 groups (Navigation / Actions / Tables) of shortcuts. |
| `TechIcon.tsx` | server | Renders a 2-letter monogram in a gradient square (deterministic color mix from base color). `slug, name, size?, className?`. |

### 3.2 Sub-component folders

| File | Purpose |
|---|---|
| `admin/admin-dashboard.tsx` | Placeholder card. `<AdminDashboard services={Service[]} />` renders one Card: "{n} services". Used by `/admin` route. |
| `auth/login-form.tsx` | `<LoginForm />` — username + password inputs, POSTs to `/api/auth`, on success `router.push("/admin")` + `router.refresh()`. Loading + error state. |
| `agents/agent-file-viewer.tsx` | Stub: `<div>Agent file viewer for {agentId}</div>`. |
| `incus/provision-wizard.tsx` | Rich 5-step provision wizard: Target → Image → Hermes → Network → Review. Loads `defaults` from `/api/incus/settings` and `images` from `/api/incus/images`. Real flow: `POST /api/incus/instances` → `POST /{name}/validate` → `POST /{name}/provision` with concurrent 2s status polling. Tracks `Phase = "form" | "validating" | "provisioning" | "done" | "failed"`. |
| `overview/widgets.tsx` | Defines the 17 widget specs (`WIDGETS: WidgetSpec[]`) and the 15-tile `DEFAULT_LAYOUT`. Each widget: `{id, title, icon, default:{w,h}, min:{w,h}, render: () => ReactNode}`. Includes: Cpu, Mem, Storage, CpuTemp, SvcOn, SvcOff, Live, Sensors, Processes, Network, Uptime, Docker, Incus, Alerts, Db, Mon, Drives. Uses a shared `historyBuffer` ring (60 entries, 5s `useQuery({queryKey:["history"], refetchInterval: 5_000})`) for CPU/memory history. |

### 3.3 `lib/sys-pilot/`

| File | Purpose |
|---|---|
| `types.ts` | All shared domain types: `Service`, `ServiceCheck`, `ServiceStatus`, `CheckStatus`, `BadgeRef`, `Badge`, `MachineSensor`, `DriveInfo`, `MountInfo`, `SystemData`, `ProcessInfo`, `NetworkInterface`, `NetworkData`, `DockerContainer`, `DockerImage`, `DockerVolume`, `DockerNetwork`, `IncusInstance`, `IncusImage`, `SystemdUnit`, `AlertRule`, `AlertHistory`, `ApprovalRequest`, `AuditEntry`, `PamUser`, `Project`, `Agent`, `MailReview`. |
| `status.ts` | `Status` type (`"online" | "offline" | "unknown" | "checking"`), `statusColor()` (returns `{dot, text, bg}` class strings), `tempColor(t)`, `usageColor(p)`, `usageBg(p)` — all use CSS vars `--success`, `--warning`, `--destructive`, `--muted-foreground`. |
| `format.ts` | `bytes(n)`, `kbps(n)`, `duration(seconds)`, `relativeTime(iso)`, `ms(n)`, `percent(n, digits?)`. |

---

## 4. Layouts & supporting infrastructure

| File | Purpose |
|---|---|
| `src/components/layout/nav-config.ts` | **Canonical** `NAV_GROUPS` (4 groups, 30 items), `ALL_NAV_ITEMS` (flat), `isNavActive(pathname, href)`. |
| `src/components/layout/app-shell.tsx` | Inner shell — actually unused (the active shell is `src/app/sys-pilot/AppShell.tsx`). |
| `src/components/layout/app-sidebar.tsx` | Alternate sidebar — also unused at runtime. |
| `src/components/layout/top-bar.tsx` | Alternate top bar — also unused. |
| `src/components/layout/types.ts` | Nav types. Tested in `__tests__/types.test.ts`. |
| `src/hooks/useKeyboardShortcuts.tsx` | Registers global keydown. **All 7 shortcuts** live here (NOT in the sys-pilot file). See §8. |
| `src/hooks/useAuth.tsx` | **Client-only mock auth**: hard-codes `is_admin = username === "admin" || "alex"`, simulates 400ms delay, persists to `localStorage` under `cortex.auth`. **Production auth is via PAM at `/api/auth`** — this hook is a fallback for offline / pre-PAM scenarios. |
| `src/hooks/use-favorites.ts` | Favorites list for the Apps page. |
| `src/hooks/use-dashboard-data.ts` + `dashboard-data-context.tsx` | Cross-page dashboard data (services, system, etc.) shared via context. |
| `src/hooks/use-socket.ts` + `socket-server.ts` + `socket.ts` (lib) | Real-time via socket.io. |
| `src/components/command-palette.tsx` | `CommandPalette` (NOT the sys-pilot one — the AppShell mounts this one). Reads `NAV_GROUPS` from `components/layout/nav-config`. Tracks recent (5) routes in `localStorage` under `cortex.palette.recent`. Actions: theme switch, show help, sign out. |
| `src/components/favorites-bar.tsx` | Quick-access favorites pinned bar. |

---

## 5. Search / filter / sort / pagination

Every table-driven page uses the **`DataTable` primitive** (see §3.1) which provides:
- **Search**: opt-in via `filterFn` prop; debounced via `useState` (NOT debounced).
- **Sort**: per-column, via `sort` function on each `Column`. Toggle asc/desc by clicking column header.
- **Pagination**: `pageSize=25` default; `Prev/Next` button footer; `Page N / M` indicator.
- **Density**: `comfortable` (default) | `compact`.
- **Selection**: `selectable + rowKey` props → checkboxes + `selectionToolbar(selected, clear)`.
- **Toolbar slot**: `toolbar: ReactNode` for actions.
- **Context menu**: `onRowContextMenu`.
- **Loading/empty**: `loading` prop → skeleton rows; `empty` prop → "No results" cell (or custom `EmptyState`).

**Search/filter implementations per page:**

| Page | Filter target |
|---|---|
| Apps | name OR slug OR description (case-insensitive) |
| Healthcheck | name OR slug OR category |
| Docker / containers | name OR image |
| Docker / images | repo OR tag |
| Docker / volumes | name |
| Systemd | name OR description |
| Incus | name OR image |
| Storage | (none) |
| Processes | command OR user OR pid-as-string |
| Approvals (history) | ruleName OR serviceName |
| Alerts / history | ruleName OR serviceName |
| Alerts / rules | name |
| Audit | actor OR tool |
| Admin / services | name OR slug OR category |
| Admin / badges | slug OR label |
| Admin / projects | name OR slug |
| Admin / systemd | name OR description |
| Admin / docker | name OR image |
| Admin / incus | name OR architecture |

**Sort columns per page** (each with a `sort` function on the column spec):
- Docker: name, image, state
- Systemd: name, description, active
- Incus: name, type, status
- Processes: pid, user, command, cpu, mem
- Approvals: ts, rule, svc
- Alerts: ts, rule, status
- Audit: ts, actor, decision
- Admin / services: name, category, kind, type, status
- Admin / badges: slug, label
- Admin / projects: name, created_at
- Admin / systemd: name, load, active
- Admin / docker: name, image, state, created
- Admin / incus: name, type, arch, snapshots, status

**Pagination defaults**: 25 rows everywhere except `/processes` (50).

---

## 6. State (loading / empty / error / success)

**Loading:**
- `DataTable` renders 6 skeleton rows when `loading` (animated pulse with `motion-reduce:animate-none`).
- Cards use `Skeleton` from `@/components/ui/skeleton` (`/systemd/[unit]`, `/incus/[name]`).
- Custom inline skeletons in `Agents` (3-column grid with `<CodeBlock>` showing loading message in container).
- `useQuery({refetchInterval: ...})` for periodic refresh — these never show global spinners, the data swaps in.

**Empty:**
- `EmptyState` component used in `/apps` (no apps), `/terminal` (admin-only 403), `LoginForm` (error inline), `agents/[slug]/agent-file-viewer.tsx` (stubs).
- `Incus/[name]/page.tsx` renders a custom empty card ("Instance not found.").
- `Backups` page: "No backups found — check the NAS mount and the cortex-backup timer."
- `Scheduler` page: "No systemd timers found."
- `Mail Guardian` left pane: "No reviews found."

**Error:**
- `useQuery` errors caught and rendered in red. Examples: `/incus/[name]` error card, `/admin/env-browser` red error line.
- `useMutation` `.onError(err)` → `toast.error(err.message)`.
- `LoginForm` shows `<p role="alert">{error}</p>` in red.

**Success:**
- `sonner` toasts everywhere: `toast.success("Created X")`, `toast.error("Failed to X")`, `toast.info("X")`.
- Optimistic UI: `qc.setQueryData([key], updater)` for many actions (start/stop, enable/disable, remove, etc.) — the request is fired in the background and the UI updates immediately.

**Toasts mounted globally**: `IncidentToaster` (alerts), mounted in `AppShell`.

---

## 7. Theme / density / accent / locale interactions

| Concern | Implementation | Where |
|---|---|---|
| Theme (dark/light/system) | `next-themes` `useTheme()` | `TopBar.tsx` (DropdownMenu), `useKeyboardShortcuts.tsx` (Cmd/Ctrl+/), `account/page.tsx`, `CommandPalette` (action) |
| Accent (cortex/teal/emerald/amber) | **Local state only** in `account/page.tsx` (`useState`); UI shows it but does NOT propagate | `account/page.tsx` |
| Density | `DataTable` `density?: "comfortable" | "compact"` — **not exposed in any page**, always defaults to comfortable | `DataTable.tsx` |
| Locale (en/es/ptBR) | `next-intl` `NextIntlClientProvider` + `messages/` directory | `app/[locale]/layout.tsx`, `account/page.tsx` (local state only) |
| Layout persistence | `localStorage` per user | `overview/page.tsx` (`cortex.overview.layout.v1`), `CommandPalette` (`cortex.palette.recent`), `useAuth` (`cortex.auth`), `use-favorites`, `use-local-storage`, `use-theme` |
| Reduced motion | `motion-reduce:animate-none` on every animated element (pulse, fade-in, etc.) | Many files |

---

## 8. Keyboard shortcuts

All shortcuts are registered in **`src/hooks/useKeyboardShortcuts.tsx`** (NOT in any sys-pilot file). The `KeyboardShortcuts` dialog content is hardcoded in `src/components/sys-pilot/KeyboardShortcuts.tsx` — and **the two lists are out of sync**.

**Live shortcuts (useKeyboardShortcuts.tsx):**

| Keys | Action |
|---|---|
| ⌘/Ctrl + K | Open command palette |
| ⌘/Ctrl + / | Toggle dark/light theme |
| ⌘/Ctrl + B | Toggle sidebar |
| ? (or Shift + /) | Show keyboard shortcuts |
| g + o | /overview |
| g + a | /apps |
| g + d | /docker |
| g + i | /incus |
| g + t | /terminal |
| g + h | /healthcheck |
| g + s | /systemd |
| g + n | /network |

`g`-sequence must be within 1200ms.

**Documented shortcuts (KeyboardShortcuts.tsx GROUPS):**

| Group | Keys | Label |
|---|---|---|
| Navigation | ⌘ K | Open command palette |
| | ? | Show keyboard shortcuts |
| | G O | Go to Overview |
| | G A | Go to Apps |
| | G D | Go to Docker |
| | G I | Go to Incus |
| | G T | Go to Terminal |
| Actions | ⌘ / | Toggle theme |
| | ⌘ B | Toggle sidebar |
| | Esc | Close dialog / palette |
| Tables | ↑ ↓ | Move selection |
| | Enter | Open row |
| | / | Focus search |

> **Discrepancy**: `useKeyboardShortcuts` actually binds `g+s` and `g+n` too, but the KeyboardShortcuts dialog doesn't list them. Likewise the dialog lists "Tables: ↑/↓/Enter//" but those are NOT actually wired anywhere.

---

## 9. Auth / RBAC / privileged actions

**Auth state** lives in `src/hooks/useAuth.tsx`:
- `user: {username, is_admin} | null`
- Persisted in `localStorage["cortex.auth"]`.
- `login()` simulates 400ms; sets `is_admin = true` for username `admin` or `alex`, else false.
- `logout()` clears state and storage.
- `switchUser(admin)` toggles `is_admin` (no-op if not logged in).

**Real auth** is `POST /api/auth` (server route) → sets a session cookie → `GET /api/auth` (re-)reads it. The `LoginForm` actually POSTs to `/api/auth`; the hook is used for the rest of the UI (e.g. gating admin buttons, logout).

**RBAC enforcement in UI** (`user?.is_admin` checks):

| Surface | Gated by |
|---|---|
| Sidebar Admin group visibility | `group.label === "Admin" && !user?.is_admin` → return null |
| `TopBar` shows "Admin" badge | `user?.is_admin` |
| Docker container Start/Stop/Restart | `disabled={!isAdmin}` |
| Docker Remove | `disabled={!isAdmin}` |
| Systemd Start/Stop/Restart + Switch | `disabled={!isAdmin}` |
| Incus Start/Stop/Restart/Delete | `{user?.is_admin && (<>…</>)}` (entire block hidden) |
| Approvals Approve/Deny | `{a.status === "pending" && user?.is_admin && …}` |
| Terminal page | `if (!user?.is_admin) return <EmptyState 403 />` |
| Incus detail "Delete" button | `{user?.is_admin && (...)}` |
| Pull image button | `{isAdmin ? <Button>Pull image…</Button> : undefined}` |
| New Incus instance | `{user?.is_admin && <Button>New instance</Button>}` |
| Admin page (`/admin/*`) | The whole `/admin/*` tree is reached only via the sidebar (which already hides it for non-admin). **There is no server-side guard** in the layouts/pages themselves. |
| `Settings` (per-user) | Reachable by any logged-in user. |

**Privileged server-side actions** (these need Schneier review per task brief):

| Endpoint | Method | Used by |
|---|---|---|
| `/api/admin/services` | POST/PATCH/DELETE | Admin services CRUD — **direct DB writes** (services table). No rate limit / RBAC inside the dashboard page; `requireAuth` is the only gate server-side. |
| `/api/admin/badges` | POST/PUT/DELETE | Admin badges CRUD. |
| `/api/admin/users` | (read-only) | View PAM users. |
| `/api/admin/projects` | POST/PUT/DELETE | Projects CRUD. |
| `/api/admin/env-browser` | GET | Reads files from `/opt/cortexos/.secrets/`. **Reads arbitrary paths** (validated in route but file content is loaded). The cleartext-reveal path is gated by `X-Cortex-Confirmation-Token` (UI cannot mint). |
| `/api/docker/actions` | POST | Real `docker start/stop/restart` on the host. |
| `/api/systemd/actions` | POST | Real `systemctl start/stop/restart` on the host. |
| `/api/incus/actions` | POST (with `x-incus-delete-confirm` for delete) | Real `incus start/stop/restart/delete`. |
| `/api/incus/{name}/shell` | POST | Real `incus exec` — arbitrary command on a running instance. |
| `/api/incus/{name}` | DELETE (or via actions) | Force-deletes an Incus instance. |
| `/api/incus/instances` | POST | Persists an instance config (wizard draft). |
| `/api/incus/instances/{name}/validate` | POST | Runs deterministic preflight gate. |
| `/api/incus/instances/{name}/provision` | POST | Provisioning entry point (writes to DB, exec's scripts). |
| `/api/terminal` | POST/GET (SSE) | Streams a real shell to the dashboard. **Plaintext shell** (per the task: this is a serious privileged surface — Schneier should review). |
| `/api/auth/password` | POST | Changes a user password (PAM). |
| `/api/badges` | POST/PUT/DELETE | Badges CRUD. |
| `/api/alerts` | POST/PATCH/DELETE | Alert rules CRUD. |
| `/api/approvals` | POST | Approves/denies pending requests (writes to `pending_approvals`). |
| `/api/mail-guardian/reviews` | POST | Records owner decision on mail reviews. |
| `/api/agents` files | GET | Lists project agent files (filesystem reads). |

**Services CRUD** writes through `getAllServices/createService/updateService/deleteService` (`src/lib/db/service.ts`); same pattern for badges, projects. **Audit chain** (writes to `dashboard_audit` table) is keyed on `tool` — Schneier should verify that every privileged write goes through `@/lib/audit` to preserve hash-chained integrity.

---

## 10. Mock / inline mock surfaces

The "fully mocked backend" the upstream template had is **mostly gone**. The remaining inline mocks:

| Source | What it does | Used by |
|---|---|---|
| `DetailDrawer.MockLogs({name, lines?})` | Generates `lines` synthetic log lines (timestamp, level=ERROR\|WARN\|INFO randomly weighted, target=name, message from a 10-string pool) | `docker/page.tsx` Logs tab |
| `DetailDrawer.MockMetrics()` | 3 random-walk series (cpu/mem/lat, 30 points each) rendered as 3 `MetricSparkCard`s | `docker/page.tsx` Metrics tab |
| `DetailDrawer.MockEnv({keys})` | Renders `[{key, value: "••••••••••••"}]` for each key | `docker/page.tsx` Environment tab |
| `LogStream.tsx` | setInterval-based client-side log simulator: emits `[ts] LEVEL source msg` every 700ms (configurable). `SOURCES = ["systemd", "docker", "incus", "kernel", "auditd", "ollama", "caddy"]`, `LEVELS = weighted`, `MESSAGES = 13-entry pool`. Includes Pause/Resume + Clear buttons. | `healthcheck/page.tsx` "Live log stream" card |
| `docker/page.tsx` inline `_SAMPLE_LOGS` | 7 hardcoded ollama log lines — **unused** (dead code) | (none) |
| `useAuth.tsx` | Mock auth (see §9) | Global |
| `incus/page.tsx` inline `ProvisionWizard` | 5-step wizard with `setTimeout(..., (i+1)*600)` to fake provisioning log lines. **Dead path** — the page also has the rich `<ProvisionWizard />` from `components/sys-pilot/incus/provision-wizard.tsx` but never imports it; it imports its own local one. | Local to `/incus` |

---

## 11. Tests already present in the template

Test files touching sys-pilot surfaces (full list — `find packages/dashboard -path '*__tests__*' -name '*.test.*' | wc -l` = 50+):

| Test | What it covers |
|---|---|
| `src/app/[locale]/__tests__/layout.test.tsx` | Locale layout wiring |
| `src/components/ui/__tests__/empty-state.test.tsx` | Generic EmptyState (the one under `ui/`, not sys-pilot's) |
| `src/components/ui/__tests__/data-table.test.tsx` | Generic DataTable |
| `src/components/ui/__tests__/theme-switcher.test.tsx` | Theme switcher |
| `src/components/layout/__tests__/types.test.ts` | Nav types |
| `src/hooks/__tests__/use-dashboard-data.test.tsx` | Hook |
| `src/hooks/__tests__/use-local-storage.test.ts` | Hook |
| `src/hooks/__tests__/use-socket.test.tsx` | Hook |
| `src/hooks/__tests__/use-theme.test.tsx` | Hook |
| `src/app/api/**/__tests__/*.test.ts` (12 files) | API route tests (services/projects/audit/incus/etc.) |
| `src/components/agents/__tests__/agent-file-viewer.test.tsx` | The `components/agents/AgentFileViewer`, NOT the sys-pilot one |
| `src/components/healthcheck/__tests__/healthcheck-table.test.tsx` | Old healthcheck table (pre-sys-pilot) |
| `src/components/admin/__tests__/admin-dashboard.test.tsx` | Old admin dashboard (pre-sys-pilot) |

> **There are NO test files for any file under `src/components/sys-pilot/` or `src/app/sys-pilot/`.** All sys-pilot components are uncovered. This is a major gap to call out in M1/M2.

---

## 12. Third-party libs of note (from `package.json`)

These libs anchor the template's UX; most are React-only and will need wrappers in Svelte (flagged in migration map):

- `next-themes` (theme) — Svelte: `mode-watcher` or roll-your-own.
- `cmdk` (command palette) — Svelte: `bits-ui` Command or hand-rolled.
- `react-grid-layout/legacy` (dashboard widget drag-resize) — Svelte: `svelte-grid` or roll-your-own.
- `recharts` (AreaTrend) — Svelte: `layerchart` or `chart.js`.
- `@xterm/xterm` (terminal) — vanilla JS, drops into Svelte fine.
- `sonner` (toasts) — Svelte: `svelte-sonner` exists.
- `@tanstack/react-query` — Svelte: `@tanstack/svelte-query` (same API).
- `framer-motion` (used in dashboard provider & some pages) — Svelte: native transitions.
- `socket.io` / `socket.io-client` — Svelte: vanilla usage works.
- `react-hook-form` + `@hookform/resolvers` + `zod` — Svelte: `sveltekit-superforms` or `felte` (zod schemas port).
- `next-intl` (i18n) — SvelteKit: built-in via `routing.ts` + `messages/`.
- `class-variance-authority`, `tailwind-merge`, `clsx` (UI primitives) — port easily.
- `lucide-react` — Svelte: `lucide-svelte`.
- `tailwindcss` v4 (CSS-first config) — works in SvelteKit.
- `socket.io` realtime channel — works in SvelteKit (server endpoints).

---

## 13. E2E + unit test status

- **Unit (Vitest):** 50+ test files. **No coverage for `sys-pilot/` primitives** (the largest gap in the template). All `__tests__/api/*` routes tested.
- **E2E (Playwright):** `playwright.config.ts` present; `e2e/` directory exists. Audit did not enumerate existing specs (E2E matrix is the M0-C workstream's domain — the matrix row references below use `TBD-M0C`).

---

## 14. Traceability matrix

> Status: every row starts as `pending`. M1/M2 will fill target SvelteKit path, backend contract, and test IDs.
>
> Conventions: `TBD-M1` = M1 plan decides; `TBD-M0C` = M0-C E2E matrix workstream decides; `TBD-M0D` = M0-D tech stack workstream decides; `TBD-M0E` = M0-E threat model workstream decides.
>
> Backend Contract column: the *current* `/api/*` path that backs the feature, or "**REAL**" if it is not a thin API call, or "**CLIENT**" if it is fully in-browser.

| # | Template Feature | Template Source File | Target SvelteKit Path | Backend Contract | E2E Test ID | Unit Test ID | Status |
|---|---|---|---|---|---|---|---|
| 1 | App shell wrapper (`AppShell`) with skip-link, sidebar, topbar, mobile tab, keyboard dialog, alert toaster | `src/app/sys-pilot/AppShell.tsx` | TBD-M0D — `src/routes/(app)/+layout.svelte` | n/a (client composition) | TBD-M0C | `unit: shell/AppShell` | pending |
| 2 | Sidebar (nav groups, admin visibility, breadcrumbs, mobile drawer) | `src/app/sys-pilot/Sidebar.tsx` | TBD-M0D — `src/lib/components/shell/Sidebar.svelte` | n/a | TBD-M0C | `unit: shell/Sidebar` | pending |
| 3 | TopBar (search trigger, theme switcher, notifications popover, user menu) | `src/app/sys-pilot/TopBar.tsx` | TBD-M0D — `src/lib/components/shell/TopBar.svelte` | n/a | TBD-M0C | `unit: shell/TopBar` | pending |
| 4 | MobileTabBar (5 fixed tabs) | `src/app/sys-pilot/MobileTabBar.tsx` | TBD-M0D — `src/lib/components/shell/MobileTabBar.svelte` | n/a | TBD-M0C | `unit: shell/MobileTabBar` | pending |
| 5 | Command palette (cmdk-based, recent routes, theme + help + logout actions) | `src/app/sys-pilot/CommandPalette.tsx` + `src/components/command-palette.tsx` (active one) | TBD-M0D — `src/lib/components/shell/CommandPalette.svelte` | n/a | TBD-M0C | `unit: shell/CommandPalette` | pending |
| 6 | Keyboard shortcuts hook (7 sequences + 3 mod-keys) | `src/hooks/useKeyboardShortcuts.tsx` | TBD-M0D — `src/lib/hooks/useKeyboardShortcuts.svelte.ts` | n/a | TBD-M0C | `unit: hooks/useKeyboardShortcuts` | pending |
| 7 | Keyboard shortcuts dialog (3 groups: Navigation / Actions / Tables) | `src/components/sys-pilot/KeyboardShortcuts.tsx` | TBD-M0D — `src/lib/components/shell/KeyboardShortcutsDialog.svelte` | n/a | TBD-M0C | `unit: shell/KeyboardShortcutsDialog` | pending |
| 8 | Incident toaster (polls /api/alerts?history=1 every 4s) | `src/components/sys-pilot/IncidentToaster.tsx` | TBD-M0D — `src/lib/components/alerts/IncidentToaster.svelte` | `GET /api/alerts?history=1` | TBD-M0C | `unit: alerts/IncidentToaster` | pending |
| 9 | Auth provider (PAM-backed, persisted) + useAuth hook | `src/hooks/useAuth.tsx` | TBD-M0D — `src/hooks.server.ts` (PAM) + `src/lib/stores/auth.svelte.ts` | `POST /api/auth`, `GET /api/auth` | TBD-M0C | `unit: hooks/useAuth` | pending |
| 10 | Login form (username + password → /api/auth) | `src/components/sys-pilot/auth/login-form.tsx` | TBD-M0D — `src/lib/components/auth/LoginForm.svelte` | `POST /api/auth` | TBD-M0C | `unit: auth/LoginForm` | pending |
| 11 | Nav config (4 groups, 30 items) | `src/components/layout/nav-config.ts` | TBD-M0D — `src/lib/nav.ts` | n/a | TBD-M0C | `unit: lib/nav` (already covered) | pending |
| 12 | PageHeader (icon + title + description + actions) | `src/components/sys-pilot/PageHeader.tsx` | TBD-M0D — `src/lib/components/ui/PageHeader.svelte` | n/a | TBD-M0C | `unit: ui/PageHeader` | pending |
| 13 | EmptyState | `src/components/sys-pilot/EmptyState.tsx` | TBD-M0D — `src/lib/components/ui/EmptyState.svelte` | n/a | TBD-M0C | `unit: ui/EmptyState` | pending |
| 14 | StatusBadge (status + ms + compact) | `src/components/sys-pilot/StatusBadge.tsx` | TBD-M0D — `src/lib/components/ui/StatusBadge.svelte` | n/a | TBD-M0C | `unit: ui/StatusBadge` | pending |
| 15 | StatusHero (aggregated banner) | `src/components/sys-pilot/StatusHero.tsx` | TBD-M0D — `src/lib/components/overview/StatusHero.svelte` | `GET /api/services`, `GET /api/system` | TBD-M0C | `unit: overview/StatusHero` | pending |
| 16 | MetricCard (KPI card) | `src/components/sys-pilot/MetricCard.tsx` | TBD-M0D — `src/lib/components/ui/MetricCard.svelte` | n/a | TBD-M0C | `unit: ui/MetricCard` | pending |
| 17 | Sparkline (SVG) | `src/components/sys-pilot/Sparkline.tsx` | TBD-M0D — `src/lib/components/ui/Sparkline.svelte` | n/a | TBD-M0C | `unit: ui/Sparkline` | pending |
| 18 | AreaTrend (recharts) | `src/components/sys-pilot/AreaTrend.tsx` | TBD-M0D — `src/lib/components/ui/AreaTrend.svelte` (swap recharts → layerchart) | n/a | TBD-M0C | `unit: ui/AreaTrend` | pending |
| 19 | GaugeRadial (SVG) | `src/components/sys-pilot/GaugeRadial.tsx` | TBD-M0D — `src/lib/components/ui/GaugeRadial.svelte` | n/a | TBD-M0C | `unit: ui/GaugeRadial` | pending |
| 20 | NetworkTopology (SVG pulse) | `src/components/sys-pilot/NetworkTopology.tsx` | TBD-M0D — `src/lib/components/network/NetworkTopology.svelte` | `GET /api/network` | TBD-M0C | `unit: network/NetworkTopology` | pending |
| 21 | KeyValueList | `src/components/sys-pilot/KeyValueList.tsx` | TBD-M0D — `src/lib/components/ui/KeyValueList.svelte` | n/a | TBD-M0C | `unit: ui/KeyValueList` | pending |
| 22 | CodeBlock + CopyButton | `src/components/sys-pilot/CodeBlock.tsx`, `CopyButton.tsx` | TBD-M0D — `src/lib/components/ui/CodeBlock.svelte` + `CopyButton.svelte` | n/a | TBD-M0C | `unit: ui/CodeBlock,CopyButton` | pending |
| 23 | ConfirmDialog (with type-to-confirm) | `src/components/sys-pilot/ConfirmDialog.tsx` | TBD-M0D — `src/lib/components/ui/ConfirmDialog.svelte` | n/a | TBD-M0C | `unit: ui/ConfirmDialog` | pending |
| 24 | DataTable (search/sort/page/select/density/loading/empty/selectable) | `src/components/sys-pilot/DataTable.tsx` | TBD-M0D — `src/lib/components/ui/DataTable.svelte` | n/a | TBD-M0C | `unit: ui/DataTable` | pending |
| 25 | DetailDrawer (Sheet + Tabs) | `src/components/sys-pilot/DetailDrawer.tsx` | TBD-M0D — `src/lib/components/ui/DetailDrawer.svelte` | n/a | TBD-M0C | `unit: ui/DetailDrawer` | pending |
| 26 | LogViewer (auto-follow, regex color) | `src/components/sys-pilot/LogViewer.tsx` | TBD-M0D — `src/lib/components/logs/LogViewer.svelte` | n/a | TBD-M0C | `unit: logs/LogViewer` | pending |
| 27 | LogStream (client-side simulator — see §6) | `src/components/sys-pilot/LogStream.tsx` | TBD-M0D — `src/lib/components/logs/LogStream.svelte` (keep mock OR swap to real SSE) | n/a (CLIENT) | TBD-M0C | `unit: logs/LogStream` | pending |
| 28 | IncidentTimeline | `src/components/sys-pilot/IncidentTimeline.tsx` | TBD-M0D — `src/lib/components/alerts/IncidentTimeline.svelte` | n/a | TBD-M0C | `unit: alerts/IncidentTimeline` | pending |
| 29 | TechIcon (monogram + gradient) | `src/components/sys-pilot/TechIcon.tsx` | TBD-M0D — `src/lib/components/ui/TechIcon.svelte` | n/a | TBD-M0C | `unit: ui/TechIcon` | pending |
| 30 | MockLogs (inline mock, used in Docker logs tab) | `src/components/sys-pilot/DetailDrawer.tsx:MockLogs` | TBD-M0D — `src/lib/components/docker/MockLogs.svelte` (KEEP until backend exposes logs) | n/a (CLIENT) | TBD-M0C | `unit: docker/MockLogs` | pending |
| 31 | MockMetrics (inline mock) | `src/components/sys-pilot/DetailDrawer.tsx:MockMetrics` | TBD-M0D — `src/lib/components/docker/MockMetrics.svelte` (KEEP or replace with real `/api/docker/{id}/metrics` if M1 adds it) | TBD-M1 (new?) | TBD-M0C | `unit: docker/MockMetrics` | pending |
| 32 | MockEnv (inline mock — secret masking) | `src/components/sys-pilot/DetailDrawer.tsx:MockEnv` | TBD-M0D — `src/lib/components/docker/MockEnv.svelte` (KEEP until backend exposes per-container env) | TBD-M1 (new?) | TBD-M0C | `unit: docker/MockEnv` | pending |
| 33 | Widget system (17 widgets + RGL layout) | `src/components/sys-pilot/overview/widgets.tsx` + `src/app/[locale]/overview/page.tsx` | TBD-M0D — `src/routes/(app)/overview/+page.svelte` + `src/lib/overview/widgets.svelte.ts` | mixed (per widget) | TBD-M0C | `unit: overview/widgets` (17 specs) | pending |
| 34 | AdminDashboard (placeholder card) | `src/components/sys-pilot/admin/admin-dashboard.tsx` | TBD-M0D — `src/routes/(app)/admin/+page.svelte` | `getAllServicesForAdmin` server fn | TBD-M0C | `unit: admin/AdminDashboard` | pending |
| 35 | Login route (`/{locale}/login`) | `src/app/[locale]/login/page.tsx` | TBD-M0D — `src/routes/login/+page.svelte` | n/a | TBD-M0C | `unit: routes/login` | pending |
| 36 | Setup route (redirect to /login) | `src/app/[locale]/setup/page.tsx` | TBD-M0D — drop or alias to `/login` | n/a | TBD-M0C | n/a | pending |
| 37 | Root `/[locale]` → redirect `/overview` | `src/app/[locale]/page.tsx` | TBD-M0D — SvelteKit `+page.ts` redirect | n/a | TBD-M0C | n/a | pending |
| 38 | `/dashboard` alias → `/overview` | `src/app/[locale]/dashboard/page.tsx` | TBD-M0D — alias route | n/a | TBD-M0C | n/a | pending |
| 39 | `/process` alias → `/processes` | `src/app/[locale]/process/page.tsx` | TBD-M0D — alias route | n/a | TBD-M0C | n/a | pending |
| 40 | `/services` alias → `/healthcheck` | `src/app/[locale]/services/page.tsx` | TBD-M0D — alias route | n/a | TBD-M0C | n/a | pending |
| 41 | `/system` alias → `/storage` | `src/app/[locale]/system/page.tsx` | TBD-M0D — alias route | n/a | TBD-M0C | n/a | pending |
| 42 | `/overview` (RGL dashboard) | `src/app/[locale]/overview/page.tsx` | TBD-M0D — `src/routes/(app)/overview/+page.svelte` | `GET /api/services`, `GET /api/system` | TBD-M0C | `unit: routes/overview` | pending |
| 43 | `/apps` (grid/list, filters, favorites) | `src/app/[locale]/apps/page.tsx` | TBD-M0D — `src/routes/(app)/apps/+page.svelte` | `GET /api/services` | TBD-M0C | `unit: routes/apps` | pending |
| 44 | `/healthcheck` (table + incident timeline + LogStream) | `src/app/[locale]/healthcheck/page.tsx` | TBD-M0D — `src/routes/(app)/healthcheck/+page.svelte` | `GET /api/services`, `GET /api/alerts?history=1` | TBD-M0C | `unit: routes/healthcheck` | pending |
| 45 | `/agents` (3-column agent viewer) | `src/app/[locale]/agents/page.tsx` | TBD-M0D — `src/routes/(app)/agents/+page.svelte` | `GET /api/agents` | TBD-M0C | `unit: routes/agents` | pending |
| 46 | `/agents/[slug]` (server detail) | `src/app/[locale]/agents/[slug]/page.tsx` | TBD-M0D — `src/routes/(app)/agents/[slug]/+page.svelte` | `scanAgents()` server fn | TBD-M0C | `unit: routes/agents/[slug]` | pending |
| 47 | `/docker` (tabs: containers / images / volumes, mock drawer) | `src/app/[locale]/docker/page.tsx` | TBD-M0D — `src/routes/(app)/docker/+page.svelte` | `GET /api/docker`, `GET /api/docker/networks` | TBD-M0C | `unit: routes/docker` | pending |
| 48 | `/docker/[id]` (real actions) | `src/app/[locale]/docker/[id]/page.tsx` | TBD-M0D — `src/routes/(app)/docker/[id]/+page.svelte` | `GET /api/docker/containers`, `POST /api/docker/actions` | TBD-M0C | `unit: routes/docker/[id]` | pending |
| 49 | `/incus` (table + local provision wizard) | `src/app/[locale]/incus/page.tsx` | TBD-M0D — `src/routes/(app)/incus/+page.svelte` (use sys-pilot `ProvisionWizard`) | `GET /api/incus/instances` | TBD-M0C | `unit: routes/incus` | pending |
| 50 | `/incus/[name]` (live status, actions, shell panel) | `src/app/[locale]/incus/[name]/page.tsx` | TBD-M0D — `src/routes/(app)/incus/[name]/+page.svelte` | `GET /api/incus/instances/{name}`, `GET /api/incus/{name}` (5s poll), `POST /api/incus/actions`, `POST /api/incus/{name}/shell` | TBD-M0C | `unit: routes/incus/[name]` | pending |
| 51 | `/incus/provision` (rich 5-step wizard) | `src/app/[locale]/incus/provision/page.tsx` + `components/sys-pilot/incus/provision-wizard.tsx` | TBD-M0D — `src/routes/(app)/incus/provision/+page.svelte` | `GET /api/incus/settings`, `GET /api/incus/images`, `POST /api/incus/instances`, `POST /validate`, `POST /provision` | TBD-M0C | `unit: incus/ProvisionWizard` (5 steps) | pending |
| 52 | `/systemd` (client-state optimistic table) | `src/app/[locale]/systemd/page.tsx` | TBD-M0D — `src/routes/(app)/systemd/+page.svelte` | `GET /api/systemd` | TBD-M0C | `unit: routes/systemd` | pending |
| 53 | `/systemd/[unit]` (real actions) | `src/app/[locale]/systemd/[unit]/page.tsx` | TBD-M0D — `src/routes/(app)/systemd/[unit]/+page.svelte` | `GET /api/systemd`, `POST /api/systemd/actions` | TBD-M0C | `unit: routes/systemd/[unit]` | pending |
| 54 | `/storage` (mounts + drives) | `src/app/[locale]/storage/page.tsx` | TBD-M0D — `src/routes/(app)/storage/+page.svelte` | `GET /api/system` (5s poll) | TBD-M0C | `unit: routes/storage` | pending |
| 55 | `/network` (4 metric cards + topology) | `src/app/[locale]/network/page.tsx` | TBD-M0D — `src/routes/(app)/network/+page.svelte` | `GET /api/network` (3s poll) | TBD-M0C | `unit: routes/network` | pending |
| 56 | `/processes` (table with progress bars) | `src/app/[locale]/processes/page.tsx` | TBD-M0D — `src/routes/(app)/processes/+page.svelte` | `GET /api/processes` (3s poll) | TBD-M0C | `unit: routes/processes` | pending |
| 57 | `/terminal` (xterm.js + SSE) | `src/app/[locale]/terminal/page.tsx` | TBD-M0D — `src/routes/(app)/terminal/+page.svelte` | `POST /api/terminal`, `GET /api/terminal?sessionId=...` SSE | TBD-M0C | `unit: routes/terminal` | pending |
| 58 | `/backups` (4 metric cards + list) | `src/app/[locale]/backups/page.tsx` | TBD-M0D — `src/routes/(app)/backups/+page.svelte` | `GET /api/backups` (30s poll) | TBD-M0C | `unit: routes/backups` | pending |
| 59 | `/scheduler` (active timers + list) | `src/app/[locale]/scheduler/page.tsx` | TBD-M0D — `src/routes/(app)/scheduler/+page.svelte` | `GET /api/scheduler` (10s poll) | TBD-M0C | `unit: routes/scheduler` | pending |
| 60 | `/mail-guardian` (2-pane review queue) | `src/app/[locale]/mail-guardian/page.tsx` | TBD-M0D — `src/routes/(app)/mail-guardian/+page.svelte` | `GET /api/mail-guardian/reviews`, `POST /api/mail-guardian/reviews` (decide) | TBD-M0C | `unit: routes/mail-guardian` | pending |
| 61 | `/alerts` (3 tabs: timeline / history / rules) | `src/app/[locale]/alerts/page.tsx` | TBD-M0D — `src/routes/(app)/alerts/+page.svelte` | `GET /api/alerts`, `GET /api/alerts?history=1` | TBD-M0C | `unit: routes/alerts` | pending |
| 62 | `/approvals` (pending/resolved + reason dialog) | `src/app/[locale]/approvals/page.tsx` | TBD-M0D — `src/routes/(app)/approvals/+page.svelte` | `GET /api/approvals`, `POST /api/approvals` | TBD-M0C | `unit: routes/approvals` | pending |
| 63 | `/audit` (table + detail sheet) | `src/app/[locale]/audit/page.tsx` | TBD-M0D — `src/routes/(app)/audit/+page.svelte` | `GET /api/audit` (10s poll) | TBD-M0C | `unit: routes/audit` | pending |
| 64 | `/admin` (placeholder services count) | `src/app/[locale]/admin/page.tsx` | TBD-M0D — `src/routes/(app)/admin/+page.svelte` | `getAllServicesForAdmin` server fn | TBD-M0C | `unit: routes/admin` | pending |
| 65 | `/admin/services` (CRUD) | `src/app/[locale]/admin/services/page.tsx` | TBD-M0D — `src/routes/(app)/admin/services/+page.svelte` | `GET/POST/PATCH/DELETE /api/admin/services` | TBD-M0C | `unit: routes/admin/services` | pending |
| 66 | `/admin/badges` (CRUD + color picker) | `src/app/[locale]/admin/badges/page.tsx` | TBD-M0D — `src/routes/(app)/admin/badges/+page.svelte` | `GET/POST/PUT/DELETE /api/badges` | TBD-M0C | `unit: routes/admin/badges` | pending |
| 67 | `/admin/env-browser` (file viewer, masked reveal) | `src/app/[locale]/admin/env-browser/page.tsx` | TBD-M0D — `src/routes/(app)/admin/env-browser/+page.svelte` | `GET /api/env-browser?path=...` | TBD-M0C | `unit: routes/admin/env-browser` | pending |
| 68 | `/admin/systemd` (real actions) | `src/app/[locale]/admin/systemd/page.tsx` | TBD-M0D — `src/routes/(app)/admin/systemd/+page.svelte` | `GET /api/systemd`, `POST /api/systemd/actions` | TBD-M0C | `unit: routes/admin/systemd` | pending |
| 69 | `/admin/docker` (real actions, removal disabled) | `src/app/[locale]/admin/docker/page.tsx` | TBD-M0D — `src/routes/(app)/admin/docker/+page.svelte` | `GET /api/docker/containers`, `POST /api/docker/actions` | TBD-M0C | `unit: routes/admin/docker` | pending |
| 70 | `/admin/alerts` (rule CRUD) | `src/app/[locale]/admin/alerts/page.tsx` | TBD-M0D — `src/routes/(app)/admin/alerts/+page.svelte` | `GET /api/alerts`, `POST/PATCH/DELETE /api/alerts` | TBD-M0C | `unit: routes/admin/alerts` | pending |
| 71 | `/admin/users` (PAM read-only) | `src/app/[locale]/admin/users/page.tsx` | TBD-M0D — `src/routes/(app)/admin/users/+page.svelte` | `GET /api/admin/users` | TBD-M0C | `unit: routes/admin/users` | pending |
| 72 | `/admin/projects` (CRUD) | `src/app/[locale]/admin/projects/page.tsx` | TBD-M0D — `src/routes/(app)/admin/projects/+page.svelte` | `GET/POST/PUT/DELETE /api/projects` | TBD-M0C | `unit: routes/admin/projects` | pending |
| 73 | `/admin/incus` (real actions) | `src/app/[locale]/admin/incus/page.tsx` | TBD-M0D — `src/routes/(app)/admin/incus/+page.svelte` | `GET /api/incus`, `POST /api/incus/actions` | TBD-M0C | `unit: routes/admin/incus` | pending |
| 74 | `/admin/audit` (table + JSON export) | `src/app/[locale]/admin/audit/page.tsx` | TBD-M0D — `src/routes/(app)/admin/audit/+page.svelte` | `GET /api/audit` (10s poll) | TBD-M0C | `unit: routes/admin/audit` | pending |
| 75 | `/admin/account` (profile + password + notifications + appearance) | `src/app/[locale]/admin/account/page.tsx` | TBD-M0D — `src/routes/(app)/admin/account/+page.svelte` | `POST /api/auth/password` | TBD-M0C | `unit: routes/admin/account` | pending |
| 76 | `/settings` (placeholder) | `src/app/[locale]/settings/page.tsx` | TBD-M0D — `src/routes/(app)/settings/+page.svelte` | n/a (TODO) | TBD-M0C | `unit: routes/settings` | pending |
| 77 | Dashboard data context (shared services/system) | `src/hooks/dashboard-data-context.tsx` | TBD-M0D — `src/lib/stores/dashboard-data.svelte.ts` | n/a | TBD-M0C | `unit: hooks/dashboard-data` (already) | pending |
| 78 | Favorites bar (pinned) | `src/components/favorites-bar.tsx` | TBD-M0D — `src/lib/components/shell/FavoritesBar.svelte` | n/a | TBD-M0C | `unit: shell/FavoritesBar` | pending |
| 79 | `lib/types.ts` re-exports | `src/lib/types.ts` | TBD-M0D — `src/lib/types.ts` | n/a | TBD-M0C | n/a | pending |
| 80 | `lib/api.ts` HTTP client (16 methods) | `src/lib/api.ts` | TBD-M0D — `src/lib/api.svelte.ts` (Remote Functions) | n/a (client) | TBD-M0C | `unit: lib/api` | pending |
| 81 | Shared domain types (Service, Docker*, Incus*, etc.) | `src/lib/sys-pilot/types.ts` | TBD-M0D — `src/lib/types.ts` | n/a | TBD-M0C | n/a | pending |
| 82 | Status helpers (statusColor/tempColor/usageColor/usageBg) | `src/lib/sys-pilot/status.ts` | TBD-M0D — `src/lib/ui/status.ts` | n/a | TBD-M0C | `unit: lib/status` | pending |
| 83 | Format helpers (bytes/kbps/duration/relativeTime/ms/percent) | `src/lib/sys-pilot/format.ts` | TBD-M0D — `src/lib/format.ts` | n/a | TBD-M0C | `unit: lib/format` | pending |

**Matrix totals:** **83 template features** documented; **5 alias/redirect pages** (counted inline); **17 widgets** (subset of feature 33); **3 inline mock helpers** (30/31/32).

---

## 15. Features NOT in the master prompt's "Target Dashboard Feature Baseline"

The task asked the squad to flag any features discovered in the template that are not in the master prompt. The master prompt was not provided to this worker, so this list is conservative — only features that look like they would be outside a typical "core VPS control panel" scope:

| Feature | Why it might be out of baseline | Decision needed |
|---|---|---|
| `/mail-guardian` — full mail review queue with model verdicts, owner decision workflow, queued actions | Mail Guardian is a CortexOS-specific service, not a generic dashboard feature. The review UI is rich (4 decision buttons, verdict color rules). | Squad: keep as-is in M1? |
| `/hermes` — referenced in canonical nav but no page exists | Dead nav entry. Either build the page in M1 or remove from nav. | Squad: build or remove? |
| `/audit` (admin) — JSON export button for the full audit chain | CortexOS-specific. Useful for offline compliance exports. | Squad: keep? |
| `/backups` — 4-card NAS backup dashboard | CortexOS-specific (`cortex-backup` timer → NAS). Not generic. | Squad: keep? |
| `/scheduler` — systemd-timers dashboard | Could overlap with `/systemd`. Currently separate. | Squad: consolidate? |
| `incus/ProvisionWizard` 5-step with Hermes profile, Tailscale key ref, proxies, web_access | Heavy project-instance creation flow, very CortexOS-specific. | Squad: keep? |
| Widget-based `/overview` (17 widgets, drag-resize, edit mode) | CortexOS-specific widget system. | Squad: keep or simplify? |
| `MockLogs / MockMetrics / MockEnv` — inline mocks still in the live UI (docker drawer) | These are explicitly fake data shown to the user. | Squad: replace with real endpoints in M1, or document as "TBD" until M1 adds the endpoints? |
| `LogStream.tsx` — client-side fake log simulator on the healthcheck page | Fake data. | Squad: replace with real `/api/logs/stream` SSE in M1? |
| `useAuth.tsx` — local mock auth (`admin`/`alex` get `is_admin=true`) | The page actually POSTs to `/api/auth` for the real session, but the hook still treats username = "admin"/"alex" as admin as a fallback. | Squad: remove the local fallback in M1? |
| `/admin/env-browser` — reads arbitrary files from `/opt/cortexos/.secrets/*.env`, masks secrets, exposes an Eye toggle gated by a confirmation token the UI cannot mint | CortexOS-specific dev tool. Privileged file read. | Squad: keep? Schneier must review. |
| Inline `ProvisionWizard` in `incus/page.tsx` (separate from the rich sys-pilot one) | Two provision wizards exist — confusion. | Squad: delete the local one, use the sys-pilot one (already done in `/incus/provision`)? |
| `Local mock` in `LoginForm` (NO — the LoginForm actually POSTs to `/api/auth`, so this is fine). | — | — |
| `_SAMPLE_LOGS` in `docker/page.tsx` — dead code (unused) | — | Delete in M1 cleanup. |
| Admin tools (services, badges, projects, alerts, users, audit) — full CRUD UIs | All gated by `is_admin` in sidebar, but not by a server-side guard in the route itself. | Squad: confirm `requireAuth`/`requireAdmin` is sufficient, or add per-route guards in M1? |
| Inline "Save" button on `/admin/account` profile — only toasts, not wired to backend | Dead UI. | Delete or wire in M1. |

**Compatibility exceptions needing Edsger's call:**

- **No React-only third-party libs are required** to keep the template's behavior. The only ones I'd flag:
  1. `cmdk` for the command palette — there is a Svelte port (`bits-ui` Command) but the API differs; acceptable, not a blocker.
  2. `react-grid-layout` — there is no first-class Svelte equivalent; we will likely need `svelte-grid` or hand-roll a grid. **This is the only meaningful compatibility exception.** Suggest Edsger approve a small lib swap (`svelte-grid` / `svelte-dnd-grid` / custom). If we hand-roll, plan a 2–3 day effort.
  3. `recharts` — there is no direct Svelte equivalent; `layerchart` is the closest. Edsger sign-off recommended for the chart-lib choice.
  4. `framer-motion` — Svelte has native transitions; not a hard blocker.

---

## 16. Open questions for the squad

1. **M0-C (E2E matrix):** Will you keep the per-page polling pattern (1s/3s/5s/10s/30s) or batch into a single SSE channel? The current implementation has 5 distinct `refetchInterval` values across 12 pages.
2. **M0-D (tech stack):** Confirm the Svelte UI lib choice — `bits-ui` (closest to shadcn semantics) or `melt-ui`? This affects the migration of `Dialog`, `Sheet`, `Tabs`, `Switch`, `Select`, `Popover`, `DropdownMenu`, `Command`, `AlertDialog`, `Slider`, `Progress`, `Skeleton`, `Badge`, `Button`, `Card`, `Input`, `Label`, `Textarea`.
3. **M0-E (threat model):** Will the admin CRUD endpoints (`/api/admin/services`, `/api/admin/badges`, `/api/admin/projects`, `/api/admin/alerts`) get a dedicated RBAC check beyond the `requireAuth`/`requireAdmin` middleware? Several pages have no per-route guard.
4. **M1 (mock replacement):** Should we commit to adding `/api/docker/{id}/logs`, `/api/docker/{id}/metrics`, `/api/docker/{id}/env`, `/api/logs/stream` (SSE) in M1, so we can delete the `MockLogs`/`MockMetrics`/`MockEnv`/`LogStream` simulators?

---

*End of TEMPLATE_INVENTORY.md — M0-B Workstream B. Next: MOCK_API_INVENTORY.md.*
