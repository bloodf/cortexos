# Lovable Prompt — CortexOS Dashboard (complete UI + Admin, all pages)

> Paste the entire fenced block below into Lovable. It is exhaustive on purpose: every page,
> component, column, action, state, and data shape is specified so Lovable produces a complete,
> professional, production-grade dashboard. Build UI-first with realistic mock data that mirrors
> the JSON shapes here, so it can be wired to the real CortexOS API later with minimal change.

---

````text
ROLE
You are a senior product designer + frontend engineer. Build "CortexOS Dashboard": a professional,
self-hosted infrastructure control-plane and observability dashboard for ONE powerful Linux server
that runs native systemd services, Docker containers, and Incus system containers. Aesthetic: a
polished hybrid of Linear + Vercel dashboard + Grafana. Dense but calm, fast, keyboard-first,
dark-mode-first, fully responsive (mobile → 4k), accessible (WCAG AA). Make it look like a real
shipping product, never a demo. Build EVERY page and state listed below — no placeholders, no
"coming soon".

================================================================================
1. TECH STACK & CONVENTIONS
================================================================================
- React + TypeScript + Vite + Tailwind CSS + shadcn/ui + lucide-react.
- Charts: recharts. Data: TanStack Query (3s refetch for live data) + a mock socket.io layer that,
  when "connected", pushes updates that override query data (simulate live drift every 2–5s and
  occasional service status flips).
- Routing: react-router, all routes prefixed with `/:locale` (en | es | pt-br; default en). A root
  redirect sends `/` → `/en/overview` (or `/en/login` if unauthenticated).
- i18n: every user-facing string from a translation file per locale (en/es/pt-br). Provide all three.
- State that persists to localStorage: theme (dark/light/system), accent preset, sidebar
  collapsed/rail, Overview widget layout, favorites, last locale.
- ALL data is mocked in one `src/mocks/` module, typed to the "DATA CONTRACTS" section, with helper
  generators so swapping to real `fetch('/api/...')` later is a one-line change per query.
- Folder shape: src/{app(shell,routing), components/{ui,layout,widgets,services,docker,incus,
  healthcheck,alerts,admin,notifications}, hooks, mocks, lib, i18n, pages}.

================================================================================
2. DESIGN SYSTEM (implement as CSS variables; light + dark; oklch)
================================================================================
Semantic tokens (define for .dark and :root light):
  background, foreground, card, card-foreground, popover, popover-foreground, muted,
  muted-foreground, border, input, ring, primary, primary-foreground, secondary,
  secondary-foreground, accent, accent-foreground, destructive, destructive-foreground,
  success, success-foreground, warning, warning-foreground, chart-1..chart-5, sidebar,
  sidebar-foreground, sidebar-accent.

Dark (default) reference values (oklch):
  --background: oklch(0.16 0.01 260); --foreground: oklch(0.97 0.01 260);
  --card: oklch(0.19 0.012 260); --muted: oklch(0.25 0.01 260);
  --muted-foreground: oklch(0.68 0.02 260); --border: oklch(0.28 0.012 260);
  --primary: oklch(0.62 0.19 277); --primary-foreground: oklch(0.99 0 0);
  --destructive: oklch(0.62 0.22 25); --success: oklch(0.70 0.17 150);
  --warning: oklch(0.79 0.16 80); --ring: var(--primary).
Light: invert lightness sensibly (background ~oklch(0.99 0.004 260), foreground ~oklch(0.20 0.02 260),
  card white, borders ~oklch(0.92 0.01 260)), keep the same hues.

Accent presets (runtime switch; only primary/accent/ring/sidebar-accent change), persisted:
  cortex = violet/indigo (primary oklch(0.62 0.19 277)),
  teal   = oklch(0.70 0.12 195),
  emerald= oklch(0.70 0.15 160),
  amber  = oklch(0.78 0.16 70).

Type & spacing: Inter / system-ui. Sizes: page title 20–24px/600; section 15px/600; body 14px;
  meta 12px muted. Numbers/metrics use tabular-nums. Radius: cards 8px, controls 6px, pills full.
  Soft shadows (elevation-1 on cards, elevation-2 on popovers/menus). 4px spacing grid.
Motion: 120–200ms ease for hover/expand; respect prefers-reduced-motion (disable non-essential).

Status semantics (use everywhere consistently):
  online = success/green dot+label; offline = destructive/red; unknown = muted/grey;
  checking = warning/amber with a gentle pulse. Latency shown as "12 ms" tabular; offline shows "—".

Mandatory states for EVERY data surface: loading (skeleton matching final layout), empty
  (centered lucide icon + short message + optional CTA), error (inline alert + Retry). Never render
  "undefined", "NaN", or a raw i18n key.

================================================================================
3. GLOBAL SHELL
================================================================================
LOGIN (/:locale/login)
- Centered card on a subtle gradient backdrop. CortexOS wordmark + logo tile. Username + password
  (PAM-style), show/hide password, "Sign in" button with loading state, inline error on failure.
  Footer: version + locale switcher. On success → /:locale/overview.

AUTH MODEL (mock)
- A `useAuth()` hook returns { user:{username, is_admin}, login, logout }. Admin-only pages and
  actions are HIDDEN for non-admins (and disabled with a tooltip where partially shown). Provide a
  dev toggle to switch between an admin and a standard user to demo gating.

SIDEBAR (left, persistent; collapsible to icon rail)
- CortexOS logo/brand at top (click → overview). Collapse/expand control; rail mode shows icon-only
  with hover tooltips. Grouped nav with small uppercase section headers. Active item: accent left
  bar (3px) + tinted background + accent icon. The "Admin" group is a collapsible disclosure
  (collapsed by default, state persisted), only rendered for admins.
- Footer of sidebar: connection/live indicator (green "Live" when socket connected, amber
  "Reconnecting"), and a compact user chip.
- Mobile: sidebar becomes a slide-over drawer (hamburger in top bar) + a fixed bottom tab bar with
  the 5 primary destinations (Overview, Apps, Healthcheck, Docker, Terminal).

TOP BAR
- Left: current page title + breadcrumb. Right (in order): global Search button labeled "Search…
  ⌘K" that opens the Command Palette; theme toggle (sun/moon); accent-preset switcher (palette
  icon → small swatch menu); notifications Bell with unread count badge + dropdown (recent alerts,
  mark-all-read, "View all" → /alerts); user menu (avatar + username + admin badge → Account,
  Logout).

COMMAND PALETTE (⌘K / Ctrl+K, or the search button)  — a real action bar
- Modal dialog with fuzzy search input + grouped results, keyboard hints in footer (↑↓ move, ↵
  select, esc close), recent items when query empty.
- Groups:
  • Navigation — every page; selecting routes there; show route as a right-aligned hint + its icon.
  • Services — every registered service (icon + name + category); selecting opens its open_url in a
    new tab (noopener).
  • Actions — Toggle theme; Switch accent preset; Re-run all health checks; Open Incus provision
    wizard; Restart service… (admin → opens a sub-picker, confirm dialog); Copy env path; Jump to
    widget…; Go to Account. Mutating/admin actions show a small "admin" tag and are gated.
- Async actions show inline spinners; on success show a toast.

NAVIGATION CONFIG (single source consumed by sidebar + mobile nav + palette)
Platform:        Overview /overview (Activity) · Apps /apps (LayoutGrid) ·
                 Healthcheck /healthcheck (HeartPulse) · Agents /agents (Bot)
Infrastructure:  Docker /docker (Container) · Incus /incus (Boxes) · Systemd /systemd (Server) ·
                 Storage /storage (HardDrive) · Network /network (Network) · Processes /processes (Cpu) ·
                 Terminal /terminal (Terminal)
Security & Ops:  Mail Guardian /mail-guardian (Mail) · Alerts /alerts (Bell) ·
                 Approvals /approvals (CheckCircle2) · Audit /audit (ScrollText)
Admin (collapsible, admin-only): Services /admin/services (Settings2) · Badges /admin/badges
                 (BadgeCheck) · Env Browser /admin/env-browser (FileKey) · Systemd /admin/systemd
                 (Server) · Docker /admin/docker (Container) · Alerts /admin/alerts (Bell) ·
                 Users /admin/users (Users) · Projects /admin/projects (FolderKanban) ·
                 Incus /admin/incus (Boxes) · Audit Log /admin/audit (ScrollText) ·
                 Account /admin/account (UserCog)

================================================================================
4. SHARED COMPONENT LIBRARY (build these, reuse everywhere)
================================================================================
- PageHeader: icon + title + description + right-aligned action slot.
- StatusBadge(status, responseTime?) with the four states above.
- TechIcon(slug, size): resolves a slug to a brand SVG when known, else a POLISHED MONOGRAM —
  a rounded-rect tile with a per-brand linear-gradient fill + the initial(s) in white bold (e.g. a
  "9" tile in orange for 9router; "G" green for grafana). Never a flat grey square. Include a
  brand-color map.
- DataTable: sortable columns, client filter/search, sticky header, density, row hover, optional
  row selection, pagination or virtualization for long lists, empty/loading/error states.
- MetricCard / GaugeRadial / Sparkline / AreaTrend (recharts wrappers).
- Badge/Chip (colored), ConfirmDialog (for destructive/admin actions, requires explicit confirm),
  Modal/Drawer, Toast system, Skeletons, EmptyState, CopyButton, Tooltip, Tabs, SegmentedControl,
  Switch/Toggle, Select/Combobox, DateRange/PeriodPicker, KeyValueList, CodeBlock/LogViewer.

================================================================================
5. DATA CONTRACTS (mock these shapes EXACTLY)
================================================================================
ServiceCheck { id:number, slug:string, name:string, open_url:string, category:string,
  status:"online"|"offline"|"unknown", responseTime:number, icon_color:string|null,
  icon_image:string|null }
Service (admin superset) adds: kind:"app"|"service"|"docker"|"process", health_url:string,
  health_type:"http"|"tcp"|"docker"|"systemd"|"process", description:string|null,
  env_source:string|null, is_active:boolean, has_webui:boolean, show_in_healthcheck:boolean,
  show_in_webui:boolean, sort_order:number, icon_type:string,
  badges:{slug:string,label:string,color:string}[].
SystemData { cpu:number, memory:{percent:number,used:number,total:number}, drives:DriveInfo[],
  mounts:MountInfo[], load:number[], uptime:number,
  sensors:{ cpuTemperature:MachineSensor|null, temperatures:MachineSensor[], fans:MachineSensor[],
    voltages:MachineSensor[] } }
MachineSensor { id:string, label:string, value:number, unit:"celsius"|"rpm"|"volts", source:string }
DriveInfo { name, model, size, type?, mount?, used?, total?, percent? }
MountInfo { filesystem, mount, total, used, free, percent }
ProcessInfo { pid:number, user:string, command:string, cpu:number, mem:number }
NetworkData { interfaces:{ name:string, rxKbps:number, txKbps:number, rxBytesTotal:number,
  txBytesTotal:number }[] }
DockerContainer { id, name, image, status, state, ports, created }; DockerImage { id, repo, tag,
  size, created }; DockerVolume { name, driver, mountpoint, size }.
IncusInstance { name, slug, status:"draft"|"validated"|"provisioning"|"active"|"failed",
  type:"container"|"vm", image, cpu, memory, config:object, devices:object, last_validation:object|null,
  created_at }.
SystemdUnit { name, description, load, active:"active"|"inactive"|"failed", sub, enabled:boolean }.
AlertRule { id, name, service_id, condition:"offline"|"online"|"response_time",
  threshold_ms:number|null, enabled:boolean }.
AlertHistory { id, ruleName, serviceName, status, message, timestamp }.
ApprovalRequest { id, actor, tool, summary, args_preview, requested_at, status:"pending"|"approved"|"denied" }.
AuditEntry { id, actor, tool, tool_class, args_hash, decision:"allow"|"deny", decision_reason,
  result, created_at }.
Badge { slug, label, color, text_color }.
PamUser { username, uid, groups:string[], is_admin:boolean }.
Project { slug, name, description, repo_url, branch, created_at }.
Agent { slug, name, description, files:{path:string, language:string}[] }.
MailReview { id, from, subject, snippet, risk:"low"|"medium"|"high", status:"pending"|"approved"|"flagged", received_at }.

SEED DATA: ~25 services across categories AI / Infrastructure / Database / Media / Monitoring:
9Router, Ollama, Honcho, Honcho MCP, Obot, Kernel Browser, Cortex Sandbox Runner, Caddy, Tailscale,
Cockpit, Webmin, Incus, Dockhand, Watchtower, DNSmasq, Fail2Ban, PostgreSQL, MySQL, Redis, MongoDB,
pgAdmin, phpMyAdmin, RedisInsight, Jellyfin, Grafana, Prometheus, Loki, cAdvisor, Home Assistant.
Most online; make 2–3 offline and 1–2 unknown for realism. Provide matching badges (AI, App, DB,
API, System, Monitoring, Media, Infra, Network, Storage, Agent, Project).

================================================================================
6. PAGES — build all, fully detailed
================================================================================

[OVERVIEW] /overview
- PageHeader "Overview" + a "Customize" toggle and an "Add widget" button.
- A DRAGGABLE, resizable widget grid: drag handles to reorder, resize across a 12-col grid, remove
  (x on hover), and an "Add widget" picker listing all unused widgets. Layout persists to
  localStorage. Default layout: a top row of small KPI gauges (CPU, Memory, CPU Temp, Uptime),
  then Live Performance + Top Processes + Network, then Services Online/Offline/Idle, then Machine
  Sensors + Docker Status + Alerts. All widgets in section 7.

[APPS] /apps
- PageHeader "Apps" + search box + category filter (chips) + status filter + a Favorites toggle +
  grid/list view switch.
- Grid of service cards: TechIcon, name, category badges, StatusBadge + latency, a star (favorite),
  and an "Open" button (opens open_url in new tab, disabled when open_url is "#"). Hover elevates.
- FIRST PAINT shows status "checking…" (amber pulse), NOT "unknown", until live data arrives.
- Empty state when filters match nothing. Favorites pinned to a top "Favorites" row.

[HEALTHCHECK] /healthcheck
- PageHeader + "Re-check all" button (spinner + toast) + period selector (24h/7d/30d).
- DataTable columns: Service (icon+name), Category, Check Type badge (http/tcp/docker/systemd/
  process, color-coded), Status, Latency, Uptime% (period), a 24h uptime sparkline, Last checked
  (relative), and a per-row "Re-check" action. Sort by any column; filter by status/type.
- Below: an Incident Timeline (status-change events with from→to, time, duration).

[AGENTS] /agents
- Two-pane: left list of agents (name, description), right detail with a file/config viewer
  (file tree + CodeBlock with syntax highlight, copy button). Empty state when none selected.

[DOCKER] /docker
- PageHeader + "Refresh" + global container search. Tabs: Containers | Images | Volumes.
- Containers table: Name, Image, Status (healthy/up/exited color), State, Ports, Created; row
  actions menu: Start/Stop/Restart/Logs (Logs opens a LogViewer drawer). Stop/Restart are
  admin-gated + ConfirmDialog. Bulk select + bulk restart.
- Images table: Repo:Tag, Image ID (mono, copy), Size, Created; action: Remove (admin, confirm).
- Volumes table: Name, Driver, Mountpoint, Size; action: Remove (admin, confirm).

[INCUS] /incus
- PageHeader + "Provision instance" CTA (primary). Table/cards of instances: Name, Type
  (container/vm), Status badge, Image, CPU, Memory, Created; row click → detail drawer.
- Detail drawer: status, resource limits, config KV list, devices, last validation result; actions
  Start/Stop/Restart/Delete (admin, confirm) + "Re-validate".
- PROVISION WIZARD (modal/stepper, 5 steps): 1) Target (existing repo URL/branch OR new project;
  description; slug; gh org; "Analyze with AI" button that prefills suggestions). 2) Image &
  resources (name, base image alias, optional gastown variant, extra profiles, cpu, memory, pool).
  3) Hermes (profile name, API port, model, proxies toggles: 9router/honcho/ollama). 4) Network
  (bridge, Tailscale join toggle + key reference name, web access). 5) Review (render the full
  config + a generated command preview with secrets redacted; "Run preflight" then "Provision").
  After submit show a live PROGRESS view: stepped log (validate → launch → wait-running → limits →
  clone → proxies → hermes → tailscale → verify), each step pending/running/ok/failed, final result.

[SYSTEMD] /systemd
- Table: Unit, Description, Load, Active (active/inactive/failed badge), Sub, Enabled (toggle);
  filter by state + search; row actions Start/Stop/Restart/Enable/Disable (admin, confirm). A
  "view logs" action opens a LogViewer drawer (journalctl-style mock).

[STORAGE] /storage
- Drives section: cards per drive (name, model, size, type) with a usage bar (used/total/percent,
  color by fullness). Mounts table: Filesystem, Mount, Total, Used, Free, Use% (bar). Donut of
  overall usage.

[NETWORK] /network
- Per-interface cards each with a live recharts area graph of rx/tx (Kbps) over a rolling window +
  current rx/tx + cumulative totals (humanized bytes). A combined throughput trend at top.

[PROCESSES] /processes
- Live top-processes DataTable: PID, User, Command (truncate+tooltip), CPU% (bar), MEM% (bar);
  sortable (default CPU desc), search, refresh indicator, "kill" action admin-gated + confirm.

[TERMINAL] /terminal  (admin-only; non-admins see a 403 empty-state)
- An xterm.js-style terminal panel filling the content area, connect/disconnect controls, session
  status, and a warning banner that this is a privileged host shell. Mock an interactive shell
  (echo commands, fake prompt). Resize-aware.

[MAIL GUARDIAN] /mail-guardian
- Security-ops styled. Queue of email reviews: From, Subject, snippet, Risk badge (low/med/high),
  Received; row → detail drawer with full message + Approve / Flag actions (confirm). Tabs: Pending
  | History. Counts in tab labels.

[ALERTS] /alerts
- Two sections: Rules (table: Name, Service, Condition (offline/online/response_time>threshold),
  Threshold, Enabled toggle; "New rule" → modal with service picker + condition + threshold;
  edit/delete). Alert History feed (timeline: severity dot, ruleName, serviceName, message, time).

[APPROVALS] /approvals
- Queue of privileged-action approval requests: Actor, Tool, Summary, args preview (mono), Requested
  (relative), Status. Pending rows have Approve / Deny (Deny opens a reason field). Tabs Pending |
  Resolved. Empty state when queue clear.

[AUDIT] /audit
- Hash-chained audit log DataTable: Time, Actor, Tool, Tool class (badge), Decision
  (allow=green/deny=red), Reason, Result; filters by actor/tool/decision + date range + search;
  row → detail drawer with full entry incl args_hash. Note the chain is tamper-evident (show a
  small "chain verified" indicator).

[ADMIN] (all admin-only; mirror read pages but with full management)
/admin/services — DataTable of all services (incl inactive) + "New service". Create/Edit modal:
  slug, name, kind, category, open_url, health_url, health_type (select), description, env_source,
  icon (upload/auto/color), badges (multi-select), toggles is_active/has_webui/show_in_healthcheck/
  show_in_webui, sort_order. Delete (confirm). Inline validation (slug pattern, url length, hex color).
/admin/badges — Badge catalog CRUD (slug, label, color, text_color) with a live chip preview.
/admin/env-browser — read-only viewer listing env-file sources; values MASKED (•••• with reveal
  disabled note); search by key/source.
/admin/systemd — systemd management (superset of /systemd with create/override-less actions).
/admin/docker — docker management (superset of /docker).
/admin/alerts — alert rule management (superset of /alerts rules).
/admin/users — PamUser table: Username, UID, Groups (chips), Admin (badge); read-only list with a
  note that membership is managed via OS groups.
/admin/projects — Project registry CRUD: slug, name, description, repo_url, branch.
/admin/incus — global Incus wizard defaults editor (image, gh org, bridge, pool, branch, default
  proxies) + an AI model picker (select from a discovered models list).
/admin/audit — full audit log (same as /audit, admin scope).
/admin/account — change password form (current/new/confirm, strength meter), active session info
  (username, admin, session age), Logout-all button.

================================================================================
7. WIDGETS (Overview grid) — build all 19, each with loading/empty states
================================================================================
1.  CPU — radial gauge of cpu%, plus load averages (1/5/15m) below.
2.  Memory — radial/bar gauge of memory.percent with used/total humanized.
3.  Storage — gauge of root/overall disk usage.
4.  CPU Temperature — big number (sensors.cpuTemperature.value) with threshold color
    (green<70, amber 70–84, red≥85 °C) + label/source.
5.  MACHINE SENSORS (rich, the flagship): a temperature radial gauge for the hottest/primary zone,
    a rolling history sparkline, a grouped list of per-zone temperatures, fan RPMs, and voltage
    rails (each row: icon by unit, label, source, value with threshold color), and a min/avg/max
    readout. Handles "no sensors exposed" empty state.
6.  Services Online — count + small trend; click → /healthcheck filtered online.
7.  Services Offline — count (red) + list of offline names; click → offline filter.
8.  Services Idle/Unknown — count.
9.  Live Performance — combined CPU% + Memory% area chart over a rolling window.
10. Top Processes — compact table (top 5 by cpu): command, cpu%, mem%.
11. Network — rx/tx area sparkline + current throughput.
12. Total Download — cumulative humanized bytes + trend.
13. Total Upload — cumulative humanized bytes + trend.
14. Database Ops — status of DB services (postgres/mysql/redis/mongo) as a mini grid.
15. Monitoring Ops — status of monitoring services (grafana/prometheus/loki/cadvisor).
16. Container Ops — running/total containers + a few names.
17. Docker Status — containers up/healthy/exited summary.
18. Host Uptime — humanized uptime ("4d 3h 12m") + boot time.
19. Alerts — most recent alert-history entries.
Every widget: title + small icon, click-through to its relevant page, loading skeleton, empty state.

================================================================================
8. I18N
================================================================================
Provide en, es, pt-br translation files covering nav labels, page titles/descriptions, table
headers, buttons, statuses, empty/error messages, and the command palette. Default en; locale
switch in the user menu + login footer; reflected in the URL `/:locale/...`.

================================================================================
9. RESPONSIVE & ACCESSIBILITY
================================================================================
- Breakpoints: mobile (drawer + bottom tabs, stacked cards, horizontally scrollable tables),
  tablet (rail sidebar), desktop (full sidebar), wide (multi-column grids). No layout shift.
- Keyboard: full tab order, visible focus rings, ⌘K palette, esc closes overlays, arrow-key nav in
  menus/lists. ARIA roles/labels on interactive elements, dialogs, and status. Color-contrast AA in
  both themes and all accent presets. Charts have text alternatives/summaries.

================================================================================
10. DEFINITION OF DONE
================================================================================
Every route above renders with realistic mock data and the three states. Dark + light parity; all
four accent presets correct. ⌘K works (search + execute). Sidebar rail + mobile drawer + bottom
tabs work. Overview grid drag/resize/add/remove persists. Admin gating hides admin pages/actions
for the standard user. Tables sort/filter; destructive/admin actions confirm. Tasteful motion that
respects reduced-motion. It should feel like a real, fast, professional infrastructure product.
````
