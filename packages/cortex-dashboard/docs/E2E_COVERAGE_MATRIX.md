# E2E Coverage Matrix — CortexOS Dashboard

> **M0-C Discovery deliverable.** Authoritative surface for the Playwright
> suite that lands across the M2 dashboard PRs. Each row is one deterministic
> test; gaps here are gaps in the M2 acceptance criterion
> (`every page and every action in the final dashboard has a Playwright E2E
> test against mocked APIs`).
>
> - **Test ID prefix** is keyed by domain (`AUTH`, `SHELL`, `OVERVIEW`, `DOCKER`,
>   `INCUS`, `SYSTEMD`, …). Three-digit sequence, zero-padded.
> - **Status** starts as `pending`. M2 PRs flip rows to `implemented` (file
>   exists, green on `main`) → `verified` (three consecutive 0% flake runs).
> - **Mock API scenario** lists the HTTP method, route, body, and the canonical
>   response shape the UI is built against. Tests must mock this — never
>   contact real Docker / Incus / systemd / PAM.
> - Rows marked `N/A — pure client-side` need no mock (theme toggle, sidebar
>   collapse, local-search, dialog open/close, etc.).
> - Destructive actions list the *exact* confirmation flow the test must
>   exercise: `ConfirmDialog` with `requireText=<name>`, then
>   `AlertDialogAction`.
> - Auth/RBAC rows come in pairs: `<id>-ALLOW` (admin sees the action) and
>   `<id>-DENY` (standard user gets 403 / disabled / hidden).
> - **Real-host test**: rare rows flagged `RHT` need a real backend because
>   no mock can reproduce the behavior (WebSocket streaming for terminal
>   log tail and the xterm rendering pipeline).

## Conventions

- All tests run on `http://127.0.0.1:3080` against the **mocked** API server
  (`playwright-mock` harness lives next to the suite). No real Docker /
  Incus / systemd / PAM contact. PAM authentication is replaced by a static
  fixture login that returns the test's desired role.
- Locale is pinned to `en` unless a test is explicitly `LOCALE-XX`.
- Viewport is `1440x900` (desktop) unless flagged `MOBILE-768` or
  `MOBILE-375`.
- Deterministic: no `Date.now()` / `Math.random()`-driven assertions. Wait
  on Playwright auto-waits + `toBeVisible` / `toHaveText` /
  `toHaveAttribute` — never `sleep()`.
- All destructive buttons must show the typed-confirmation step in the test.

## Surface Map (informational)

- **Pages**: 23 routes (13 platform/infra/secops, 11 admin, plus redirects
  `/services`, `/system`, `/process`, `/dashboard`, `/setup`, `[locale]/`).
- **Detail routes**: `/docker/[id]`, `/systemd/[unit]`, `/incus/[name]`,
  `/incus/provision`, `/agents/[slug]`.
- **Modal/dialog primitives in use**: `Dialog`, `AlertDialog` (via
  `ConfirmDialog`), `Sheet` (right-side detail drawer), `Popover`,
  `CommandDialog` (palette), `DropdownMenu`, `Tabs`, `Tooltip`.
- **Theme system**: `useTheme` (`light`/`dark`/`system` ×
  `cortex`/`teal`/`emerald`/`amber` accent preset). Preset is persisted in
  `cortex-preset` cookie; mode is `next-themes` localStorage.
- **Layout system**: `AppShell` (sidebar + topbar + main + mobile tab bar),
  `CommandPalette` (⌘K / Ctrl+K), `FavoritesBar` (client-only
  localStorage).
- **i18n**: `en` (default), `es`, `pt-br`; routed under `/[locale]/...`.

## Section Index

- [§1 Auth & Session](#1-auth--session)
- [§2 App Shell](#2-app-shell)
- [§3 Overview (Dashboard Home)](#3-overview)
- [§4 Apps](#4-apps)
- [§5 Healthcheck](#5-healthcheck)
- [§6 Docker](#6-docker)
- [§7 Incus](#7-incus)
- [§8 Systemd](#8-systemd)
- [§9 Storage](#9-storage)
- [§10 Network](#10-network)
- [§11 Processes](#11-processes)
- [§12 Terminal](#12-terminal)
- [§13 Backups](#13-backups)
- [§14 Scheduler](#14-scheduler)
- [§15 Alerts](#15-alerts)
- [§16 Approvals](#16-approvals)
- [§17 Audit](#17-audit)
- [§18 Mail Guardian](#18-mail-guardian)
- [§19 Agents](#19-agents)
- [§20 Admin · Services](#20-admin-services)
- [§21 Admin · Badges](#21-admin-badges)
- [§22 Admin · Env Browser](#22-admin-env-browser)
- [§23 Admin · Systemd](#23-admin-systemd)
- [§24 Admin · Docker](#24-admin-docker)
- [§25 Admin · Alerts](#25-admin-alerts)
- [§26 Admin · Users](#26-admin-users)
- [§27 Admin · Projects](#27-admin-projects)
- [§28 Admin · Incus](#28-admin-incus)
- [§29 Admin · Audit Log](#29-admin-audit-log)
- [§30 Admin · Account](#30-admin-account)
- [§31 AI Chat Panel (floating)](#31-ai-chat-panel)
- [§32 Redirects, Settings, Error / Loading States](#32-redirects-settings-error--loading-states)
- [§33 Cross-cutting — Keyboard Shortcuts, Toasts, Empty / Loading / Error UI](#33-cross-cutting)
- [§34 Test IDs Not Deterministically Mockable](#34-real-host-test-rht-exceptions)
- [§35 Domain Roll-up](#35-domain-roll-up)

---

<a id="1-auth--session"></a>
## §1 Auth & Session

Auth is Linux PAM. The dashboard UI cannot mint the actual PAM challenge, so
every auth test goes through a mock that emulates the `/api/auth` response
shape (200 → sets session cookie; 401 → error toast; 405 → admin users
mutations). RBAC is driven by `user.is_admin` in the mocked session payload.

| Page | Action | Mock API Scenario | Expected Result | E2E Test File | Test ID | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `/[locale]/login` | Open login page (redirected from protected route) | `GET /api/auth` (no cookie) → 401 | Login form renders; shield icon + "Sign in to access administration" copy; username + password inputs, Login button | `e2e/auth.spec.ts` | `E2E-AUTH-001` | pending |
| `/[locale]/login` | Submit valid credentials (admin) | `POST /api/auth {username,password}` → 200 `{success,username,is_admin:true}` + sets `cortex-session` cookie | Redirects to `/{locale}/admin`; topbar shows admin avatar with "Admin" badge | `e2e/auth.spec.ts` | `E2E-AUTH-002` | pending |
| `/[locale]/login` | Submit valid credentials (standard) | `POST /api/auth {username,password}` → 200 `{success,username,is_admin:false}` | Redirects to `/{locale}/overview`; topbar shows "Standard user" badge | `e2e/auth.spec.ts` | `E2E-AUTH-003` | pending |
| `/[locale]/login` | Submit empty fields | N/A (HTML5 `required` blocks submit) | Browser-native validation tooltip on each input | `e2e/auth.spec.ts` | `E2E-AUTH-004` | pending |
| `/[locale]/login` | Submit invalid credentials | `POST /api/auth` → 401 `{error:"Invalid credentials"}` | Red error text "Invalid credentials" appears above the form; inputs retain values; Login button re-enables | `e2e/auth.spec.ts` | `E2E-AUTH-005` | pending |
| `/[locale]/login` | Submit 500 from server | `POST /api/auth` → 500 `{error:"Internal server error"}` | Red error "Internal server error" appears | `e2e/auth.spec.ts` | `E2E-AUTH-006` | pending |
| `/[locale]/login` | Network failure (offline) | `POST /api/auth` → network reject | Red error "Network error" appears | `e2e/auth.spec.ts` | `E2E-AUTH-007` | pending |
| `/[locale]/login` | Press Enter in password field | Same as AUTH-002 happy path | Form submits; redirect happens | `e2e/auth.spec.ts` | `E2E-AUTH-008` | pending |
| `/[locale]/setup` | Hit `/setup` route | N/A (redirect-only) | Server-side redirect to `/{locale}/login`; login form renders | `e2e/auth.spec.ts` | `E2E-AUTH-009` | pending |
| Global | Logout from topbar account menu | `DELETE /api/auth` → 200 `{success}` + clears cookie | Redirected to `/{locale}/login`; protected pages now 401 | `e2e/auth.spec.ts` | `E2E-AUTH-010` | pending |
| Global | Logout from command-palette action | Same as AUTH-010, triggered via `⌘K` → "Sign out" | Same as AUTH-010 | `e2e/auth.spec.ts` | `E2E-AUTH-011` | pending |
| Global | Session expired (401 mid-session) | Any API → 401 | App shows toast and redirects to `/{locale}/login` | `e2e/auth.spec.ts` | `E2E-AUTH-012` | pending |
| Global | RBAC: admin link group visible | `GET /api/auth` → admin payload | Sidebar "Admin" collapsible group is rendered; first item is `/admin/services` | `e2e/auth-rbac.spec.ts` | `E2E-AUTH-013` | pending |
| Global | RBAC: standard user hides admin group | `GET /api/auth` → standard payload | Sidebar **does not** render "Admin" group; visiting `/admin/*` returns 403 page or redirect | `e2e/auth-rbac.spec.ts` | `E2E-AUTH-014` | pending |
| Global | RBAC: standard user tries admin POST | `POST /api/admin/services` → 403 | Toast error "Failed to save service" / "Forbidden" | `e2e/auth-rbac.spec.ts` | `E2E-AUTH-015` | pending |

---

<a id="2-app-shell"></a>
## §2 App Shell — Sidebar / Topbar / Mobile / Command Palette / Theme / Locale

| Page | Action | Mock API Scenario | Expected Result | E2E Test File | Test ID | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Global | Page loads with sidebar visible (desktop ≥ md) | `GET /api/services` (FavoritesBar prefetch) | Sidebar rendered with "CortexOS" logo, 4 nav groups (Platform / Infrastructure / Security & Ops / Admin) | `e2e/shell.spec.ts` | `E2E-SHELL-001` | pending |
| Global | Toggle sidebar collapse (desktop) | N/A | Sidebar width shrinks; group labels hide; nav icons remain; tooltip shows label on hover | `e2e/shell.spec.ts` | `E2E-SHELL-002` | pending |
| Global | Toggle sidebar via `⌘B` / `Ctrl+B` | N/A | Same as SHELL-002 | `e2e/shell.spec.ts` | `E2E-SHELL-003` | pending |
| Global | Open mobile drawer via hamburger | N/A — viewport `MOBILE-375` | Drawer slides in from left, `aria-label="Close"` button visible | `e2e/shell.spec.ts` | `E2E-SHELL-004` | pending |
| Global | Close mobile drawer via overlay click | N/A | Drawer slides out; main content visible | `e2e/shell.spec.ts` | `E2E-SHELL-005` | pending |
| Global | Close mobile drawer via close button | N/A | Drawer slides out | `e2e/shell.spec.ts` | `E2E-SHELL-006` | pending |
| Global | Click nav link → navigates | N/A — page is client-side router | Route changes; active item highlighted; breadcrumb updates | `e2e/shell.spec.ts` | `E2E-SHELL-007` | pending |
| Global | Click active nav link on child route | N/A | `path.startsWith(href+'/')` keeps parent highlighted; e.g. `/incus/foo` highlights "Incus" | `e2e/shell.spec.ts` | `E2E-SHELL-008` | pending |
| Global | Mobile tab bar visible on `<md` | N/A | 5 bottom tabs (Overview / Apps / Healthcheck / Docker / Terminal) render | `e2e/shell.spec.ts` | `E2E-SHELL-009` | pending |
| Global | Mobile tab bar hidden on `≥md` | N/A | Bottom tab bar not in DOM | `e2e/shell.spec.ts` | `E2E-SHELL-010` | pending |
| Global | Open command palette via topbar search button | N/A | Modal opens, input focused, Navigation group listed with all 26 nav items | `e2e/shell.spec.ts` | `E2E-SHELL-011` | pending |
| Global | Open command palette via `⌘K` / `Ctrl+K` | N/A | Same as SHELL-011 | `e2e/shell.spec.ts` | `E2E-SHELL-012` | pending |
| Global | Close command palette via `Esc` | N/A | Modal closes; focus returns to triggering element | `e2e/shell.spec.ts` | `E2E-SHELL-013` | pending |
| Global | Type in palette — filters nav + services | `GET /api/services?webui=true` once, on open | List narrows in real time; `<CommandEmpty>` shows "No results found." when no match | `e2e/shell.spec.ts` | `E2E-SHELL-014` | pending |
| Global | Pick a nav result from palette | N/A | Router pushes; modal closes; toast-less; URL matches selected item | `e2e/shell.spec.ts` | `E2E-SHELL-015` | pending |
| Global | Pick a service result from palette | Mock service in `/api/services?webui=true` | New tab opens to `service.open_url` with `noopener,noreferrer`; palette closes | `e2e/shell.spec.ts` | `E2E-SHELL-016` | pending |
| Global | Palette action: "Switch to light/dark mode" | N/A — `next-themes` toggles | `<html class>` flips; label updates | `e2e/shell.spec.ts` | `E2E-SHELL-017` | pending |
| Global | Palette action: "Switch accent to <preset>" | N/A — `cortex-preset` cookie | `<html class="theme-<next>">` applied; cookie updated | `e2e/shell.spec.ts` | `E2E-SHELL-018` | pending |
| Global | Open keyboard shortcuts overlay via `?` | N/A | Dialog lists Navigation / Actions / Tables groups | `e2e/shell.spec.ts` | `E2E-SHELL-019` | pending |
| Global | Open keyboard shortcuts via topbar `?` button | N/A | Same as SHELL-019 | `e2e/shell.spec.ts` | `E2E-SHELL-020` | pending |
| Global | `g` then `o` → /overview | N/A | Router pushes `/overview`; g-o detected within 1.2s | `e2e/shell.spec.ts` | `E2E-SHELL-021` | pending |
| Global | `g` then `a` → /apps | N/A | Router pushes `/apps` | `e2e/shell.spec.ts` | `E2E-SHELL-022` | pending |
| Global | `g` then `d` → /docker | N/A | Router pushes `/docker` | `e2e/shell.spec.ts` | `E2E-SHELL-023` | pending |
| Global | `g` then `i` → /incus | N/A | Router pushes `/incus` | `e2e/shell.spec.ts` | `E2E-SHELL-024` | pending |
| Global | `g` then `t` → /terminal | N/A | Router pushes `/terminal` | `e2e/shell.spec.ts` | `E2E-SHELL-025` | pending |
| Global | `g` then `h` → /healthcheck | N/A | Router pushes `/healthcheck` | `e2e/shell.spec.ts` | `E2E-SHELL-026` | pending |
| Global | `g` then `s` → /systemd | N/A | Router pushes `/systemd` | `e2e/shell.spec.ts` | `E2E-SHELL-027` | pending |
| Global | `g` then `n` → /network | N/A | Router pushes `/network` | `e2e/shell.spec.ts` | `E2E-SHELL-028` | pending |
| Global | `⌘/` / `Ctrl+/` toggles theme | N/A | Mode flips; `next-themes` localStorage updated | `e2e/shell.spec.ts` | `E2E-SHELL-029` | pending |
| Global | Keyboard shortcut while in `<input>` | N/A | `g`+letter is suppressed when typing in field | `e2e/shell.spec.ts` | `E2E-SHELL-030` | pending |
| Topbar | Theme dropdown: pick Light/Dark/System | N/A | Mode updates; `<html class>` reflects choice | `e2e/shell.spec.ts` | `E2E-SHELL-031` | pending |
| Topbar | Notifications popover | N/A — no `/api/notifications` route | Popover opens with "Notifications" header, "0 unread", "No notifications yet" body | `e2e/shell.spec.ts` | `E2E-SHELL-032` | pending |
| Topbar | Account menu: shows username + role | Mocks `useAuth` returning `{username,is_admin}` | Avatar shows first 2 chars uppercase; label "Admin" or "Standard user" | `e2e/shell.spec.ts` | `E2E-SHELL-033` | pending |
| Topbar | Account menu: click Logout | `DELETE /api/auth` → 200 | Redirects to `/login` | `e2e/shell.spec.ts` | `E2E-SHELL-034` | pending |
| Sidebar | Open Admin group (collapsible) | N/A | Chevron rotates; sub-items render | `e2e/shell.spec.ts` | `E2E-SHELL-035` | pending |
| Sidebar | Skip-to-main-content link (a11y) | N/A | First Tab focuses "Skip to main content"; Enter jumps focus to `<main>` | `e2e/shell.spec.ts` | `E2E-SHELL-036` | pending |
| Breadcrumb | Crumbs reflect current path | N/A | Topbar breadcrumb segments match `pathname`; last segment is non-link | `e2e/shell.spec.ts` | `E2E-SHELL-037` | pending |
| Locale | Switch to `es` | N/A — `next-intl` router replace | URL changes to `/es/<path>`; copy translated (mock message catalog) | `e2e/shell.spec.ts` | `E2E-SHELL-LOCALE-ES-038` | pending |
| Locale | Switch to `pt-br` | N/A | URL changes to `/pt-br/<path>` | `e2e/shell.spec.ts` | `E2E-SHELL-LOCALE-PTBR-039` | pending |
| Locale | Unknown locale falls back to `en` | N/A | URL normalizes to `/en/...` | `e2e/shell.spec.ts` | `E2E-SHELL-LOCALE-FALLBACK-040` | pending |
| Favorites | Add favorite from Apps page | `localStorage` write `cortex-favorites` | FavoritesBar appears with chip; persists across reload | `e2e/shell.spec.ts` | `E2E-SHELL-FAV-ADD-041` | pending |
| Favorites | Remove favorite from FavoritesBar | `localStorage` update | Chip removed; persists across reload | `e2e/shell.spec.ts` | `E2E-SHELL-FAV-REMOVE-042` | pending |
| Favorites | Empty favorites hides bar | `localStorage` `[]` | FavoritesBar not rendered (early-return) | `e2e/shell.spec.ts` | `E2E-SHELL-FAV-EMPTY-043` | pending |
| Theme | SSR no-flash: cookie sets class on first paint | Cookie `cortex-preset=emerald` | `<html class="theme-emerald">` present in initial HTML | `e2e/shell.spec.ts` | `E2E-SHELL-PRESET-COOKIE-044` | pending |
| Incident | IncidentToaster shows pop-up on `alerts/operational` event | `GET /api/alerts/operational` SSE/WS → payload | Sonner toast appears with title + description; auto-dismiss after 5s | `e2e/shell.spec.ts` | `E2E-SHELL-INCIDENT-045` | pending |


---

<a id="3-overview"></a>
## §3 Overview (Dashboard Home)

Widgets are defined in `components/sys-pilot/overview/widgets.tsx` (16
widgets). Layout is react-grid-layout, persisted in `localStorage` under
`cortex.overview.layout.v1`. Edit mode adds drag/resize/remove affordances.

| Page | Action | Mock API Scenario | Expected Result | E2E Test File | Test ID | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `/[locale]/overview` | Page load — default layout | `GET /api/system` returns `{cpu, memory, drives, mounts, load, uptime, sensors, ...}`; `GET /api/services`; `GET /api/alerts?history=1`; `GET /api/network`; `GET /api/processes`; `GET /api/docker`; `GET /api/incus/instances` | StatusHero + 15 default widgets render (CPU, Memory, Storage, CPU Temp, Svc online/offline, Live perf, Sensors, Top procs, Network, Uptime, Docker, Incus, Alerts, Drives) | `e2e/overview.spec.ts` | `E2E-OVERVIEW-001` | pending |
| `/[locale]/overview` | Click `Edit` button | N/A | Banner "Edit mode — drag widgets to rearrange…" appears; drag handles + `×` per widget become visible; button label flips to "Done" | `e2e/overview.spec.ts` | `E2E-OVERVIEW-002` | pending |
| `/[locale]/overview` | Click `Done` (saves layout) | N/A — localStorage write | Banner disappears; toast "Layout saved"; layout persisted to `cortex.overview.layout.v1` | `e2e/overview.spec.ts` | `E2E-OVERVIEW-003` | pending |
| `/[locale]/overview` | Drag widget in edit mode | N/A | Other widgets reflow; on drop new x/y/w/h persisted | `e2e/overview.spec.ts` | `E2E-OVERVIEW-004` | pending |
| `/[locale]/overview` | Resize widget (drag bottom-right) | N/A | Size changes; minW/minH respected; persisted | `e2e/overview.spec.ts` | `E2E-OVERVIEW-005` | pending |
| `/[locale]/overview` | Click `×` on a widget (remove) | N/A | Widget disappears; "Add widget" popover includes the removed id | `e2e/overview.spec.ts` | `E2E-OVERVIEW-006` | pending |
| `/[locale]/overview` | `Add widget` popover — add removed widget | N/A | Widget reappears at end of grid; popover updates "available" list | `e2e/overview.spec.ts` | `E2E-OVERVIEW-007` | pending |
| `/[locale]/overview` | `Add widget` popover — empty list | N/A — all widgets present | "All widgets are on the dashboard." text; button disabled | `e2e/overview.spec.ts` | `E2E-OVERVIEW-008` | pending |
| `/[locale]/overview` | Click `Reset` button | N/A | All widgets restored to `DEFAULT_LAYOUT`; toast "Layout reset to default" | `e2e/overview.spec.ts` | `E2E-OVERVIEW-009` | pending |
| `/[locale]/overview` | Reload page after edit | localStorage read at mount | Custom layout restored | `e2e/overview.spec.ts` | `E2E-OVERVIEW-010` | pending |
| `/[locale]/overview` | StatusHero healthy state | `/api/system` low CPU + memory | Hero shows "All systems normal" | `e2e/overview.spec.ts` | `E2E-OVERVIEW-011` | pending |
| `/[locale]/overview` | StatusHero warning state | `/api/system` CPU > 80% | Hero shows warning variant | `e2e/overview.spec.ts` | `E2E-OVERVIEW-012` | pending |
| `/[locale]/overview` | StatusHero critical state | `/api/system` CPU > 95% or memory > 95% | Hero shows critical variant | `e2e/overview.spec.ts` | `E2E-OVERVIEW-013` | pending |
| `/[locale]/overview` | CPU widget sparkline accumulates points | 3 consecutive `/api/system` polls over 10s | Sparkline shows 3 points growing | `e2e/overview.spec.ts` | `E2E-OVERVIEW-014` | pending |
| `/[locale]/overview` | Sensors gauge — colored thresholds | `/api/system.sensors.cpuTemperature.value=92` | Gauge ring red | `e2e/overview.spec.ts` | `E2E-OVERVIEW-015` | pending |
| `/[locale]/overview` | Top processes table sort | `/api/processes` returns list | Click PID/User/Command/CPU/MEM header reorders rows; arrow icon flips | `e2e/overview.spec.ts` | `E2E-OVERVIEW-016` | pending |
| `/[locale]/overview` | Network widget — empty interfaces | `/api/network {interfaces:[]}` | "0" displayed for both Rx/Tx; no rows | `e2e/overview.spec.ts` | `E2E-OVERVIEW-017` | pending |
| `/[locale]/overview` | Recent alerts widget — fired status | `/api/alerts?history=1` returns fired entry | Red "FIRED" badge | `e2e/overview.spec.ts` | `E2E-OVERVIEW-018` | pending |
| `/[locale]/overview` | Mobile responsive layout | Viewport `MOBILE-375` | Breakpoint `xxs` (2 cols) renders; widgets stack vertically | `e2e/overview.spec.ts` | `E2E-OVERVIEW-019` | pending |


---

<a id="4-apps"></a>
## §4 Apps

Source: `app/[locale]/apps/page.tsx`. Reads `/api/services` every 3s.

| Page | Action | Mock API Scenario | Expected Result | E2E Test File | Test ID | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `/[locale]/apps` | Page load | `GET /api/services` → array of `Service` with `name,slug,category,status,responseTime,icon_color,icon_image,description,badges,open_url` | Grid of app cards with icon, name, category, description, status badge, "Open" link | `e2e/apps.spec.ts` | `E2E-APPS-001` | pending |
| `/[locale]/apps` | Search input filters apps | `GET /api/services` returns mixed categories | Typing `gr` narrows to matches in name/slug/description | `e2e/apps.spec.ts` | `E2E-APPS-002` | pending |
| `/[locale]/apps` | Category filter chip — `All` | N/A | All apps shown; "All" chip highlighted | `e2e/apps.spec.ts` | `E2E-APPS-003` | pending |
| `/[locale]/apps` | Category filter chip — specific | N/A | Only services in that category; chip highlighted | `e2e/apps.spec.ts` | `E2E-APPS-004` | pending |
| `/[locale]/apps` | Status filter — `all` | N/A | All visible | `e2e/apps.spec.ts` | `E2E-APPS-005` | pending |
| `/[locale]/apps` | Status filter — `online` | N/A | Only `status:"online"` shown | `e2e/apps.spec.ts` | `E2E-APPS-006` | pending |
| `/[locale]/apps` | Status filter — `offline` | N/A | Only `status:"offline"` shown | `e2e/apps.spec.ts` | `E2E-APPS-007` | pending |
| `/[locale]/apps` | View toggle — grid | N/A | Cards render in `grid-cols-2 sm:3 lg:4` | `e2e/apps.spec.ts` | `E2E-APPS-008` | pending |
| `/[locale]/apps` | View toggle — list | N/A | Rows render in `divide-y` card with icon + status + Open link | `e2e/apps.spec.ts` | `E2E-APPS-009` | pending |
| `/[locale]/apps` | Star toggle — add favorite | localStorage | Star fills, favorites bar appears | `e2e/apps.spec.ts` | `E2E-APPS-010` | pending |
| `/[locale]/apps` | Star toggle — remove favorite | localStorage | Star unfills; favorites bar updates | `e2e/apps.spec.ts` | `E2E-APPS-011` | pending |
| `/[locale]/apps` | `Open` link opens external URL | N/A | New tab → `service.open_url` with `noopener,noreferrer` | `e2e/apps.spec.ts` | `E2E-APPS-012` | pending |
| `/[locale]/apps` | Empty state (no matches) | mock services array empty after filter | `EmptyState` with "No apps match" + "Try clearing filters." | `e2e/apps.spec.ts` | `E2E-APPS-013` | pending |
| `/[locale]/apps` | Loading skeletons | mock delays 1s on `/api/services` | 8 skeleton cards animate-pulse | `e2e/apps.spec.ts` | `E2E-APPS-014` | pending |
| `/[locale]/apps` | Badges render on cards | `badges:[{slug,label,color}]` populated | Up to 3 colored chips below description | `e2e/apps.spec.ts` | `E2E-APPS-015` | pending |
| `/[locale]/apps` | Favorites section appears | at least 1 favorite | "Favorites" subhead + grid | `e2e/apps.spec.ts` | `E2E-APPS-016` | pending |

---

<a id="5-healthcheck"></a>
## §5 Healthcheck

| Page | Action | Mock API Scenario | Expected Result | E2E Test File | Test ID | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `/[locale]/healthcheck` | Page load | `GET /api/services` (with `?healthcheck=true` filter applied in `api.healthcheck`), `GET /api/alerts?history=1` (refetch 3s) | DataTable of services with `show_in_healthcheck` flag; period selector (1h/24h/7d); IncidentTimeline card; Live log stream card | `e2e/healthcheck.spec.ts` | `E2E-HEALTH-001` | pending |
| `/[locale]/healthcheck` | Period selector — `1h` | N/A | Button active; no network call (visual only) | `e2e/healthcheck.spec.ts` | `E2E-HEALTH-002` | pending |
| `/[locale]/healthcheck` | Period selector — `24h` | N/A | Button active | `e2e/healthcheck.spec.ts` | `E2E-HEALTH-003` | pending |
| `/[locale]/healthcheck` | Period selector — `7d` | N/A | Button active | `e2e/healthcheck.spec.ts` | `E2E-HEALTH-004` | pending |
| `/[locale]/healthcheck` | Search filter | N/A | Filters by name/slug/category | `e2e/healthcheck.spec.ts` | `E2E-HEALTH-005` | pending |
| `/[locale]/healthcheck` | Sort by name | N/A | Rows ordered by `name` asc/desc | `e2e/healthcheck.spec.ts` | `E2E-HEALTH-006` | pending |
| `/[locale]/healthcheck` | Sort by status | N/A | Rows ordered by `status` | `e2e/healthcheck.spec.ts` | `E2E-HEALTH-007` | pending |
| `/[locale]/healthcheck` | Sort by latency | N/A | Rows ordered by `responseTime` | `e2e/healthcheck.spec.ts` | `E2E-HEALTH-008` | pending |
| `/[locale]/healthcheck` | Click `Recheck` button | invalidates `["services"]` query → refetches `/api/services` | Spinner; new `responseTime`; toast "Re-checked <slug>" | `e2e/healthcheck.spec.ts` | `E2E-HEALTH-009` | pending |
| `/[locale]/healthcheck` | Status badge — online | `status:"online"` | Green pill | `e2e/healthcheck.spec.ts` | `E2E-HEALTH-010` | pending |
| `/[locale]/healthcheck` | Status badge — offline | `status:"offline"` | Red pill | `e2e/healthcheck.spec.ts` | `E2E-HEALTH-011` | pending |
| `/[locale]/healthcheck` | Status badge — unknown | `status:"unknown"` | Grey pill | `e2e/healthcheck.spec.ts` | `E2E-HEALTH-012` | pending |
| `/[locale]/healthcheck` | Latency — `0` | `responseTime:0` | Em-dash "—" rendered | `e2e/healthcheck.spec.ts` | `E2E-HEALTH-013` | pending |
| `/[locale]/healthcheck` | Incident timeline — fired event | `alerts` with `status:"fired"` | Red dot, "FIRED" copy in `relativeTime` | `e2e/healthcheck.spec.ts` | `E2E-HEALTH-014` | pending |
| `/[locale]/healthcheck` | Incident timeline — resolved event | `alerts` with `status:"resolved"` | Green dot, "RESOLVED" | `e2e/healthcheck.spec.ts` | `E2E-HEALTH-015` | pending |
| `/[locale]/healthcheck` | Live log stream | mock `/api/logs/...` SSE/WS | Auto-scrolling tail; height 360 | `e2e/healthcheck.spec.ts` | `E2E-HEALTH-016` | pending |
| `/[locale]/healthcheck` | Empty services | `show_in_healthcheck:[]` | "No results" empty state in table | `e2e/healthcheck.spec.ts` | `E2E-HEALTH-017` | pending |


---

<a id="6-docker"></a>
## §6 Docker

Source: `app/[locale]/docker/page.tsx`, `docker/[id]/page.tsx`. Tabs:
Containers / Images / Volumes. All actions are admin-only (non-admin sees
disabled buttons).

| Page | Action | Mock API Scenario | Expected Result | E2E Test File | Test ID | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `/[locale]/docker` | Page load | `GET /api/docker` → `{containers:{data:[]}, images:{data:[]}, volumes:{data:[]}}`; `GET /api/docker/networks` (admin) | Page header + 3 tabs; default tab Containers | `e2e/docker.spec.ts` | `E2E-DOCKER-001` | pending |
| `/[locale]/docker` | Switch tab — Containers | N/A | Container table | `e2e/docker.spec.ts` | `E2E-DOCKER-002` | pending |
| `/[locale]/docker` | Switch tab — Images | N/A | Image table | `e2e/docker.spec.ts` | `E2E-DOCKER-003` | pending |
| `/[locale]/docker` | Switch tab — Volumes | N/A | Volume table | `e2e/docker.spec.ts` | `E2E-DOCKER-004` | pending |
| `/[locale]/docker` | Container search filter | N/A | Filters by name or image (lowercased) | `e2e/docker.spec.ts` | `E2E-DOCKER-005` | pending |
| `/[locale]/docker` | Container sort — name | N/A | Asc/desc by name | `e2e/docker.spec.ts` | `E2E-DOCKER-006` | pending |
| `/[locale]/docker` | Container sort — state | N/A | Asc/desc by state | `e2e/docker.spec.ts` | `E2E-DOCKER-007` | pending |
| `/[locale]/docker` | Click container name → detail | N/A — link to `/docker/<id>` | Detail page loads with Overview tab active | `e2e/docker.spec.ts` | `E2E-DOCKER-008` | pending |
| `/[locale]/docker` | Container Logs button (admin) | opens DetailDrawer (mock logs) | Right-side sheet opens; Logs tab default; mock log lines render | `e2e/docker.spec.ts` | `E2E-DOCKER-LOGS-009` | pending |
| `/[locale]/docker` | Container Metrics tab in drawer | mock metrics | 3 sparkline cards (CPU / Mem / p95) | `e2e/docker.spec.ts` | `E2E-DOCKER-METRICS-010` | pending |
| `/[locale]/docker` | Container Environment tab in drawer | mock env keys | KV list with masked values | `e2e/docker.spec.ts` | `E2E-DOCKER-ENV-011` | pending |
| `/[locale]/docker` | Close drawer with Esc / overlay | N/A | Sheet closes | `e2e/docker.spec.ts` | `E2E-DOCKER-DRAWER-CLOSE-012` | pending |
| `/[locale]/docker` | Start container (admin) | `POST /api/docker/actions {action:"start", name}` → 200 | Local state flips state→running; toast "Started <name>" | `e2e/docker.spec.ts` | `E2E-DOCKER-START-013` | pending |
| `/[locale]/docker` | Start container — API error | `POST /api/docker/actions` → 500 `{error}` | Red toast "Failed to start <name>" | `e2e/docker.spec.ts` | `E2E-DOCKER-START-ERR-014` | pending |
| `/[locale]/docker` | Stop container (admin) | `POST /api/docker/actions {action:"stop", name}` → 200 | State→exited; toast "Stopped" | `e2e/docker.spec.ts` | `E2E-DOCKER-STOP-015` | pending |
| `/[locale]/docker` | Restart container (admin) | `POST /api/docker/actions {action:"restart", name}` → 200 | Toast "Restarting…" then "Restarted" | `e2e/docker.spec.ts` | `E2E-DOCKER-RESTART-016` | pending |
| `/[locale]/docker` | Remove container — open confirm | N/A | AlertDialog with `requireText=<name>` input; confirm disabled until typed | `e2e/docker.spec.ts` | `E2E-DOCKER-REMOVE-OPEN-017` | pending |
| `/[locale]/docker` | Remove container — type wrong text | N/A | Confirm button disabled | `e2e/docker.spec.ts` | `E2E-DOCKER-REMOVE-WRONG-018` | pending |
| `/[locale]/docker` | Remove container — type correct text + confirm | N/A (client-only filter) | Row removed; toast "Removed <name>" | `e2e/docker.spec.ts` | `E2E-DOCKER-REMOVE-CONFIRM-019` | pending |
| `/[locale]/docker` | Remove container — cancel | N/A | Dialog closes; no change | `e2e/docker.spec.ts` | `E2E-DOCKER-REMOVE-CANCEL-020` | pending |
| `/[locale]/docker` | All action buttons disabled for non-admin | Mocks standard user | All action buttons in row are `disabled` | `e2e/docker.spec.ts` | `E2E-DOCKER-DENY-021` | pending |
| `/[locale]/docker` | Admin `Pull image…` button visible | admin | "Pull image…" appears in header | `e2e/docker.spec.ts` | `E2E-DOCKER-PULL-VISIBLE-022` | pending |
| `/[locale]/docker` | Admin `Pull image…` hidden for non-admin | standard | Not rendered | `e2e/docker.spec.ts` | `E2E-DOCKER-PULL-HIDDEN-023` | pending |
| `/[locale]/docker` | Header shows running/total/imag/vol counts | Mocks arrays | `N running · M images · K volumes` rendered | `e2e/docker.spec.ts` | `E2E-DOCKER-HEADER-024` | pending |
| `/[locale]/docker` | Image ID slice (`7,19`) | mock `id:"sha256:abcdef..."` | `<code>` shows middle 12 chars | `e2e/docker.spec.ts` | `E2E-DOCKER-IMG-ID-025` | pending |
| `/[locale]/docker` | Volume sort by name | N/A | Asc/desc | `e2e/docker.spec.ts` | `E2E-DOCKER-VOL-SORT-026` | pending |
| `/[locale]/docker` | Volume sort by size | N/A | Asc/desc | `e2e/docker.spec.ts` | `E2E-DOCKER-VOL-SIZE-027` | pending |
| `/[locale]/docker` | Loading skeletons | 1s mock delay | Skeleton rows in table | `e2e/docker.spec.ts` | `E2E-DOCKER-LOADING-028` | pending |
| `/[locale]/docker/[id]` | Open detail page | `GET /api/docker` returns container w/ id | Name, image, state badge, status, ports, created | `e2e/docker.spec.ts` | `E2E-DOCKER-DETAIL-029` | pending |
| `/[locale]/docker/[id]` | Detail Overview tab | N/A | KV list of Name/ID/Image/State/Status/Ports/Created | `e2e/docker.spec.ts` | `E2E-DOCKER-DETAIL-OVERVIEW-030` | pending |
| `/[locale]/docker/[id]` | Detail Logs tab | N/A | Placeholder card "Live container logs are not available — no log endpoint is exposed by the backend." | `e2e/docker.spec.ts` | `E2E-DOCKER-DETAIL-LOGS-031` | pending |
| `/[locale]/docker/[id]` | Start from detail (admin) | `POST /api/docker/actions {action:"start"}` → 200 | Toast success; header buttons swap to Stop | `e2e/docker.spec.ts` | `E2E-DOCKER-DETAIL-START-032` | pending |
| `/[locale]/docker/[id]` | Stop from detail (admin) | `POST /api/docker/actions {action:"stop"}` → 200 | Toast success | `e2e/docker.spec.ts` | `E2E-DOCKER-DETAIL-STOP-033` | pending |
| `/[locale]/docker/[id]` | Restart from detail (admin) | `POST /api/docker/actions {action:"restart"}` → 200 | Toast success | `e2e/docker.spec.ts` | `E2E-DOCKER-DETAIL-RESTART-034` | pending |
| `/[locale]/docker/[id]` | Detail not found (bad id) | mock container array empty | Empty card "No container found for <id>." | `e2e/docker.spec.ts` | `E2E-DOCKER-DETAIL-404-035` | pending |
| `/[locale]/docker/[id]` | Back link | N/A | Router back to `/docker` | `e2e/docker.spec.ts` | `E2E-DOCKER-DETAIL-BACK-036` | pending |
| `/[locale]/docker/[id]` | Action buttons hidden for non-admin | standard user | No action buttons in header | `e2e/docker.spec.ts` | `E2E-DOCKER-DETAIL-DENY-037` | pending |


---

<a id="7-incus"></a>
## §7 Incus

| Page | Action | Mock API Scenario | Expected Result | E2E Test File | Test ID | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `/[locale]/incus` | Page load | `GET /api/incus/instances` → `{data:[]}` | Header with "New instance" (admin) + DataTable | `e2e/incus.spec.ts` | `E2E-INCUS-001` | pending |
| `/[locale]/incus` | Search filter | N/A | Filters by name/image | `e2e/incus.spec.ts` | `E2E-INCUS-002` | pending |
| `/[locale]/incus` | Sort by name | N/A | Asc/desc | `e2e/incus.spec.ts` | `E2E-INCUS-003` | pending |
| `/[locale]/incus` | Sort by type | N/A | Asc/desc | `e2e/incus.spec.ts` | `E2E-INCUS-004` | pending |
| `/[locale]/incus` | Sort by status | N/A | Asc/desc | `e2e/incus.spec.ts` | `E2E-INCUS-005` | pending |
| `/[locale]/incus` | Click row chevron | N/A | Detail drawer opens w/ KeyValueList + YAML Config + YAML Devices | `e2e/incus.spec.ts` | `E2E-INCUS-DRAWER-006` | pending |
| `/[locale]/incus` | Close drawer | N/A | Sheet closes | `e2e/incus.spec.ts` | `E2E-INCUS-DRAWER-CLOSE-007` | pending |
| `/[locale]/incus` | Click name → detail page | N/A | Routes to `/incus/<name>` | `e2e/incus.spec.ts` | `E2E-INCUS-008` | pending |
| `/[locale]/incus` | `New instance` (admin) — open wizard | N/A | Dialog opens, Step 1/5 | `e2e/incus.spec.ts` | `E2E-INCUS-WIZARD-OPEN-009` | pending |
| `/[locale]/incus` | Wizard step 1 — name input | N/A | Default `hermes-canary`; can edit | `e2e/incus.spec.ts` | `E2E-INCUS-WIZARD-NAME-010` | pending |
| `/[locale]/incus` | Wizard step 2 — image select | N/A | Options `ubuntu/24.04`, `debian/12`, `alpine/3.20` | `e2e/incus.spec.ts` | `E2E-INCUS-WIZARD-IMAGE-011` | pending |
| `/[locale]/incus` | Wizard step 3 — CPU input | N/A | `Input type=number`; default 2 | `e2e/incus.spec.ts` | `E2E-INCUS-WIZARD-CPU-012` | pending |
| `/[locale]/incus` | Wizard step 4 — Memory input | N/A | `Input type=number`; default 4096 | `e2e/incus.spec.ts` | `E2E-INCUS-WIZARD-MEM-013` | pending |
| `/[locale]/incus` | Wizard `Back` button | N/A | Decrements step; preserves inputs | `e2e/incus.spec.ts` | `E2E-INCUS-WIZARD-BACK-014` | pending |
| `/[locale]/incus` | Wizard `Next` button | N/A | Increments step | `e2e/incus.spec.ts` | `E2E-INCUS-WIZARD-NEXT-015` | pending |
| `/[locale]/incus` | Wizard `Provision` button | N/A (client-side setTimeout chain) | Step 5 logs stream; "Provisioning complete" appears; new row inserted | `e2e/incus.spec.ts` | `E2E-INCUS-WIZARD-PROVISION-016` | pending |
| `/[locale]/incus` | Wizard `Done` button | N/A | Dialog closes; toast "Provisioned <name>" | `e2e/incus.spec.ts` | `E2E-INCUS-WIZARD-DONE-017` | pending |
| `/[locale]/incus` | Wizard cancel via Esc / overlay | N/A | Dialog closes; state reset | `e2e/incus.spec.ts` | `E2E-INCUS-WIZARD-CANCEL-018` | pending |
| `/[locale]/incus` | `New instance` hidden for non-admin | standard | Button not in DOM | `e2e/incus.spec.ts` | `E2E-INCUS-NEW-DENY-019` | pending |
| `/[locale]/incus/[name]` | Detail page load | `GET /api/incus/instances/<name>` → `{data}`; `GET /api/incus/<name>` → live info | KV list of name, slug, saved status, live status, created_by, created, updated, last_request_id; JSON Config; Last Validation; Live Info | `e2e/incus.spec.ts` | `E2E-INCUS-DETAIL-020` | pending |
| `/[locale]/incus/[name]` | Detail 404 | `GET /api/incus/instances/<name>` → 404 | "Instance not found." card | `e2e/incus.spec.ts` | `E2E-INCUS-DETAIL-404-021` | pending |
| `/[locale]/incus/[name]` | Detail API error | `GET /api/incus/instances/<name>` → 500 | Red error card with message | `e2e/incus.spec.ts` | `E2E-INCUS-DETAIL-ERR-022` | pending |
| `/[locale]/incus/[name]` | Detail Start (admin, not running) | `POST /api/incus/actions {action:"start",name}` → 200 | Toast "start succeeded"; status updates to running on refetch | `e2e/incus.spec.ts` | `E2E-INCUS-DETAIL-START-023` | pending |
| `/[locale]/incus/[name]` | Detail Stop (admin, running) | `POST /api/incus/actions {action:"stop",name}` → 200 | Toast success; status → stopped | `e2e/incus.spec.ts` | `E2E-INCUS-DETAIL-STOP-024` | pending |
| `/[locale]/incus/[name]` | Detail Restart (admin) | `POST /api/incus/actions {action:"restart",name}` → 200 | Toast success | `e2e/incus.spec.ts` | `E2E-INCUS-DETAIL-RESTART-025` | pending |
| `/[locale]/incus/[name]` | Detail Delete — open AlertDialog | N/A | Dialog with title "Delete <name>?" + danger copy | `e2e/incus.spec.ts` | `E2E-INCUS-DETAIL-DELETE-OPEN-026` | pending |
| `/[locale]/incus/[name]` | Detail Delete — cancel | N/A | Dialog closes | `e2e/incus.spec.ts` | `E2E-INCUS-DETAIL-DELETE-CANCEL-027` | pending |
| `/[locale]/incus/[name]` | Detail Delete — confirm | `POST /api/incus/actions {action:"delete",name}` with header `x-incus-delete-confirm: true` → 200 | Dialog closes; toast success | `e2e/incus.spec.ts` | `E2E-INCUS-DETAIL-DELETE-CONFIRM-028` | pending |
| `/[locale]/incus/[name]` | Detail Delete — server missing confirm header | mock returns 400 | Red toast error from server message | `e2e/incus.spec.ts` | `E2E-INCUS-DETAIL-DELETE-NO-HEADER-029` | pending |
| `/[locale]/incus/[name]` | Detail — actions hidden for non-admin | standard | No Start/Stop/Restart/Delete buttons | `e2e/incus.spec.ts` | `E2E-INCUS-DETAIL-DENY-030` | pending |
| `/[locale]/incus/[name]` | Shell panel disabled when stopped | mock `live.status=stopped` | Input + Run disabled; placeholder "Instance must be running to exec" | `e2e/incus.spec.ts` | `E2E-INCUS-SHELL-DISABLED-031` | pending |
| `/[locale]/incus/[name]` | Shell run command (running) | `POST /api/incus/<name>/shell {command:"uname -a"}` → 200 `{stdout,stderr}` | Output rendered in `<CodeBlock>` | `e2e/incus.spec.ts` | `E2E-INCUS-SHELL-RUN-032` | pending |
| `/[locale]/incus/[name]` | Shell run command — empty cmd | N/A | Run button disabled | `e2e/incus.spec.ts` | `E2E-INCUS-SHELL-EMPTY-033` | pending |
| `/[locale]/incus/[name]` | Shell run command — server error | mock 500 `{error}` | Red toast; output contains error | `e2e/incus.spec.ts` | `E2E-INCUS-SHELL-ERR-034` | pending |
| `/[locale]/incus/[name]` | Shell hidden for non-admin | standard | ShellPanel not rendered | `e2e/incus.spec.ts` | `E2E-INCUS-SHELL-DENY-035` | pending |
| `/[locale]/incus/[name]` | Back link | N/A | Routes to `/incus` | `e2e/incus.spec.ts` | `E2E-INCUS-DETAIL-BACK-036` | pending |
| `/[locale]/incus/provision` | Open provision page | N/A — server component renders wizard | Header + `<ProvisionWizard />` (multi-step) renders | `e2e/incus.spec.ts` | `E2E-INCUS-PROV-PAGE-037` | pending |
| `/[locale]/incus/provision` | Wizard step — name | N/A | `Input` for project name | `e2e/incus.spec.ts` | `E2E-INCUS-PROV-NAME-038` | pending |
| `/[locale]/incus/provision` | Wizard step — launch method (clone vs new) | N/A | Radio/Select present | `e2e/incus.spec.ts` | `E2E-INCUS-PROV-METHOD-039` | pending |
| `/[locale]/incus/provision` | Wizard step — review | N/A | Summary list | `e2e/incus.spec.ts` | `E2E-INCUS-PROV-REVIEW-040` | pending |
| `/[locale]/incus/provision` | Wizard submit | mocked `POST /api/incus/instances/<name>/provision` → 200 | Success card with next steps | `e2e/incus.spec.ts` | `E2E-INCUS-PROV-SUBMIT-041` | pending |
| `/[locale]/incus/provision` | Wizard submit — error | mocked 400 `{error}` | Red error | `e2e/incus.spec.ts` | `E2E-INCUS-PROV-ERR-042` | pending |
| `/[locale]/incus/provision` | Provision status polling | mocked `/api/incus/instances/<name>/provision/status` returns `{state:"running"}` | UI updates from `provisioning` → `active` | `e2e/incus.spec.ts` | `E2E-INCUS-PROV-STATUS-043` | pending |
| `/[locale]/incus/provision` | AI analyze | `POST /api/incus/ai/analyze` → 200 `{recommendation}` | Inline panel with recommendation text | `e2e/incus.spec.ts` | `E2E-INCUS-AI-ANALYZE-044` | pending |
| `/[locale]/incus/provision` | AI analyze — models endpoint | `GET /api/incus/ai/models` → list | Model dropdown populated | `e2e/incus.spec.ts` | `E2E-INCUS-AI-MODELS-045` | pending |
| `/[locale]/incus` | Settings link opens settings page | `GET /api/incus/settings` | Incus settings panel (storage pool, network, profiles) | `e2e/incus.spec.ts` | `E2E-INCUS-SETTINGS-046` | pending |
| `/[locale]/incus` | Images tab | `GET /api/incus/images` | Image list | `e2e/incus.spec.ts` | `E2E-INCUS-IMAGES-047` | pending |


---

<a id="8-systemd"></a>
## §8 Systemd

| Page | Action | Mock API Scenario | Expected Result | E2E Test File | Test ID | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `/[locale]/systemd` | Page load | `GET /api/systemd` → `{services:[]}` | Header + DataTable | `e2e/systemd.spec.ts` | `E2E-SYSTEMD-001` | pending |
| `/[locale]/systemd` | Search filter | N/A | Filters by name/description | `e2e/systemd.spec.ts` | `E2E-SYSTEMD-002` | pending |
| `/[locale]/systemd` | Sort by name | N/A | Asc/desc | `e2e/systemd.spec.ts` | `E2E-SYSTEMD-003` | pending |
| `/[locale]/systemd` | Sort by active | N/A | Asc/desc | `e2e/systemd.spec.ts` | `E2E-SYSTEMD-004` | pending |
| `/[locale]/systemd` | Click unit name → detail | N/A | Routes to `/systemd/<name>` | `e2e/systemd.spec.ts` | `E2E-SYSTEMD-005` | pending |
| `/[locale]/systemd` | Start (admin) | client-only optimistic | State→active; toast "Started <name>" | `e2e/systemd.spec.ts` | `E2E-SYSTEMD-START-006` | pending |
| `/[locale]/systemd` | Stop (admin) | client-only optimistic | State→inactive; toast "Stopped" | `e2e/systemd.spec.ts` | `E2E-SYSTEMD-STOP-007` | pending |
| `/[locale]/systemd` | Restart (admin) | client-only optimistic | Toast "Restarted" | `e2e/systemd.spec.ts` | `E2E-SYSTEMD-RESTART-008` | pending |
| `/[locale]/systemd` | Enable toggle (admin) | client-only optimistic | `enabled:true`; toast | `e2e/systemd.spec.ts` | `E2E-SYSTEMD-ENABLE-009` | pending |
| `/[locale]/systemd` | Disable toggle (admin) | client-only optimistic | `enabled:false`; toast | `e2e/systemd.spec.ts` | `E2E-SYSTEMD-DISABLE-010` | pending |
| `/[locale]/systemd` | Action buttons disabled for non-admin | standard | All action buttons `disabled` | `e2e/systemd.spec.ts` | `E2E-SYSTEMD-DENY-011` | pending |
| `/[locale]/systemd` | Header counts active/total | mocks | `N units · M active` | `e2e/systemd.spec.ts` | `E2E-SYSTEMD-HEADER-012` | pending |
| `/[locale]/systemd` | Empty state | mock returns `[]` | "No results" in table | `e2e/systemd.spec.ts` | `E2E-SYSTEMD-EMPTY-013` | pending |
| `/[locale]/systemd/[unit]` | Detail load | `GET /api/systemd` returns unit | KV list (Description, Load, Active, Sub, Enabled) | `e2e/systemd.spec.ts` | `E2E-SYSTEMD-DETAIL-014` | pending |
| `/[locale]/systemd/[unit]` | Detail not found | unit absent from list | "Unit <name> not found." card | `e2e/systemd.spec.ts` | `E2E-SYSTEMD-DETAIL-404-015` | pending |
| `/[locale]/systemd/[unit]` | Detail Start (admin) | `POST /api/systemd/actions {action:"start",name}` → 200 | Toast success | `e2e/systemd.spec.ts` | `E2E-SYSTEMD-DETAIL-START-016` | pending |
| `/[locale]/systemd/[unit]` | Detail Stop (admin) | `POST /api/systemd/actions {action:"stop",name}` → 200 | Toast success | `e2e/systemd.spec.ts` | `E2E-SYSTEMD-DETAIL-STOP-017` | pending |
| `/[locale]/systemd/[unit]` | Detail Restart (admin) | `POST /api/systemd/actions {action:"restart",name}` → 200 | Toast success | `e2e/systemd.spec.ts` | `E2E-SYSTEMD-DETAIL-RESTART-018` | pending |
| `/[locale]/systemd/[unit]` | Detail action — server 500 | mock 500 | Red toast with error message | `e2e/systemd.spec.ts` | `E2E-SYSTEMD-DETAIL-ERR-019` | pending |
| `/[locale]/systemd/[unit]` | Detail action — server 400 | mock 400 | Red toast with `body.error` | `e2e/systemd.spec.ts` | `E2E-SYSTEMD-DETAIL-ERR400-020` | pending |
| `/[locale]/systemd/[unit]` | Back link | N/A | Routes to `/systemd` | `e2e/systemd.spec.ts` | `E2E-SYSTEMD-DETAIL-BACK-021` | pending |
| `/[locale]/systemd/[unit]` | Detail action buttons disabled for non-admin | standard | Buttons disabled | `e2e/systemd.spec.ts` | `E2E-SYSTEMD-DETAIL-DENY-022` | pending |

---

<a id="9-storage"></a>
## §9 Storage

| Page | Action | Mock API Scenario | Expected Result | E2E Test File | Test ID | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `/[locale]/storage` | Page load | `GET /api/system` (refetch 5s) → `{drives, mounts}` | Mountpoints card with progress bars + Block devices DataTable | `e2e/storage.spec.ts` | `E2E-STORAGE-001` | pending |
| `/[locale]/storage` | Mountpoint bar under 50% | `mounts[0].percent:30` | Green bar | `e2e/storage.spec.ts` | `E2E-STORAGE-MOUNT-LOW-002` | pending |
| `/[locale]/storage` | Mountpoint bar 50-90% | `mounts[0].percent:75` | Yellow bar | `e2e/storage.spec.ts` | `E2E-STORAGE-MOUNT-MID-003` | pending |
| `/[locale]/storage` | Mountpoint bar over 90% | `mounts[0].percent:95` | Red bar | `e2e/storage.spec.ts` | `E2E-STORAGE-MOUNT-HIGH-004` | pending |
| `/[locale]/storage` | Sort drives by name | N/A | Asc/desc | `e2e/storage.spec.ts` | `E2E-STORAGE-DRIVE-SORT-005` | pending |
| `/[locale]/storage` | Sort drives by size | N/A | Asc/desc | `e2e/storage.spec.ts` | `E2E-STORAGE-DRIVE-SIZE-006` | pending |
| `/[locale]/storage` | Empty drives | `drives:[]` | "No results" in table | `e2e/storage.spec.ts` | `E2E-STORAGE-EMPTY-007` | pending |
| `/[locale]/storage` | Loading state | 1s delay | Skeleton block | `e2e/storage.spec.ts` | `E2E-STORAGE-LOADING-008` | pending |

---

<a id="10-network"></a>
## §10 Network

| Page | Action | Mock API Scenario | Expected Result | E2E Test File | Test ID | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `/[locale]/network` | Page load | `GET /api/network` (refetch 3s) | 4 metric cards (Rx total, Tx total, Lifetime Rx, Lifetime Tx) + `<NetworkTopology>` + interface cards | `e2e/network.spec.ts` | `E2E-NET-001` | pending |
| `/[locale]/network` | Rx/Tx totals | mock `interfaces[].rxKbps,txKbps` | Cards show kbps formatted | `e2e/network.spec.ts` | `E2E-NET-TOTALS-002` | pending |
| `/[locale]/network` | Empty interfaces | `interfaces:[]` | "0" in metric cards; no interface cards | `e2e/network.spec.ts` | `E2E-NET-EMPTY-003` | pending |
| `/[locale]/network` | Interface card renders | mock `interfaces:[{name:"eth0",rxKbps,txKbps,rxBytesTotal,txBytesTotal}]` | Card shows `eth0` + 4 rows | `e2e/network.spec.ts` | `E2E-NET-IFACE-004` | pending |
| `/[locale]/network` | NetworkTopology node click | N/A — interactive viz | Side panel / focus state | `e2e/network.spec.ts` | `E2E-NET-TOPO-005` | pending |

---

<a id="11-processes"></a>
## §11 Processes

| Page | Action | Mock API Scenario | Expected Result | E2E Test File | Test ID | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `/[locale]/processes` | Page load | `GET /api/processes` (refetch 3s) | DataTable (PID/User/Command/CPU%/MEM%) with pageSize 50 | `e2e/processes.spec.ts` | `E2E-PROC-001` | pending |
| `/[locale]/processes` | Search filter | N/A | Filters by command/user/PID | `e2e/processes.spec.ts` | `E2E-PROC-002` | pending |
| `/[locale]/processes` | Sort by PID | N/A | Asc/desc | `e2e/processes.spec.ts` | `E2E-PROC-SORT-PID-003` | pending |
| `/[locale]/processes` | Sort by user | N/A | Asc/desc | `e2e/processes.spec.ts` | `E2E-PROC-SORT-USER-004` | pending |
| `/[locale]/processes` | Sort by CPU | N/A | Asc/desc | `e2e/processes.spec.ts` | `E2E-PROC-SORT-CPU-005` | pending |
| `/[locale]/processes` | Pagination — Next | N/A | Page 2 of N; Prev enabled | `e2e/processes.spec.ts` | `E2E-PROC-NEXT-006` | pending |
| `/[locale]/processes` | Pagination — Prev | N/A | Page 1 of N; Prev disabled | `e2e/processes.spec.ts` | `E2E-PROC-PREV-007` | pending |
| `/[locale]/processes` | Progress bar renders for CPU/MEM | mock `cpu:42,mem:75` | Bars at correct % | `e2e/processes.spec.ts` | `E2E-PROC-PROGRESS-008` | pending |
| `/[locale]/processes` | Empty list | `processes:[]` | "No results" in table | `e2e/processes.spec.ts` | `E2E-PROC-EMPTY-009` | pending |

---

<a id="12-terminal"></a>
## §12 Terminal

| Page | Action | Mock API Scenario | Expected Result | E2E Test File | Test ID | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `/[locale]/terminal` | Non-admin opens page | N/A — client guard | "403 · Admin only" EmptyState; no terminal | `e2e/terminal.spec.ts` | `E2E-TERM-DENY-001` | pending |
| `/[locale]/terminal` | Admin opens page | `POST /api/terminal {action:"connect",sessionId}` → 200; SSE opens `/api/terminal?sessionId=...` | xterm canvas renders, prompt | `e2e/terminal.spec.ts` | `E2E-TERM-OPEN-002` | pending |
| `/[locale]/terminal` | Type command → backend POST | `POST /api/terminal {action:"exec",data:"<keystrokes>"}` → 200 | Echo via SSE stream writes to xterm | `e2e/terminal.spec.ts` | `E2E-TERM-EXEC-003` | pending |
| `/[locale]/terminal` | Server connect error | mock 500 `{error}` | Red ANSI error line in xterm | `e2e/terminal.spec.ts` | `E2E-TERM-CONNECT-ERR-004` | pending |
| `/[locale]/terminal` | SSE stream error | mock disconnect | Yellow ANSI "[stream disconnected]" | `e2e/terminal.spec.ts` | `E2E-TERM-SSE-ERR-005` | pending |
| `/[locale]/terminal` | Disconnect on unmount | `POST /api/terminal {action:"disconnect"}` → 200 | Cleanup happens; no orphan request | `e2e/terminal.spec.ts` | `E2E-TERM-DISCONNECT-006` | pending |
| `/[locale]/terminal` | Resize observer triggers FitAddon | resize window | Terminal reflows | `e2e/terminal.spec.ts` | `E2E-TERM-RESIZE-007` | pending |
| `/[locale]/terminal` | Theme sync (light/dark) | toggle theme | xterm `theme` updates | `e2e/terminal.spec.ts` | `E2E-TERM-THEME-008` | pending |
| `/[locale]/terminal` | Real-host coverage (see §34) | WebSocket + xterm canvas | Defer to integration smoke; canonical row in §34 | `e2e/terminal.spec.ts` | `E2E-TERM-RHT-REF-009` | pending (RHT) |

---

<a id="13-backups"></a>
## §13 Backups

| Page | Action | Mock API Scenario | Expected Result | E2E Test File | Test ID | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `/[locale]/backups` | Page load | `GET /api/backups` (refetch 30s) → `{backups:[]}` | 2 metric cards (Total / Last) + list | `e2e/backups.spec.ts` | `E2E-BACKUP-001` | pending |
| `/[locale]/backups` | Total size sum | mock sizes `[1024, 2048]` | Card shows "3.0 KB on disk" | `e2e/backups.spec.ts` | `E2E-BACKUP-TOTAL-002` | pending |
| `/[locale]/backups` | Last backup timestamp | mock `backups[0].created_at` | Card shows date + time | `e2e/backups.spec.ts` | `E2E-BACKUP-LAST-003` | pending |
| `/[locale]/backups` | Empty list | `backups:[]` | "No backups found — check the NAS mount and the cortex-backup timer." | `e2e/backups.spec.ts` | `E2E-BACKUP-EMPTY-004` | pending |
| `/[locale]/backups` | Row status badge — done | `status:"done"` | Default badge | `e2e/backups.spec.ts` | `E2E-BACKUP-DONE-005` | pending |
| `/[locale]/backups` | Row status badge — other | `status:"pending"` | Outline badge | `e2e/backups.spec.ts` | `E2E-BACKUP-PENDING-006` | pending |
| `/[locale]/backups` | Loading state | 1s delay | "Loading…" centered | `e2e/backups.spec.ts` | `E2E-BACKUP-LOADING-007` | pending |

---

<a id="14-scheduler"></a>
## §14 Scheduler

| Page | Action | Mock API Scenario | Expected Result | E2E Test File | Test ID | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `/[locale]/scheduler` | Page load | `GET /api/scheduler` (refetch 10s) → `{jobs:[]}` | 2 metric cards (Active timers / Next run) + list of jobs | `e2e/scheduler.spec.ts` | `E2E-SCHED-001` | pending |
| `/[locale]/scheduler` | Active timer count | `jobs:[{enabled:true},{enabled:false}]` | Card "1" + "1 inactive" | `e2e/scheduler.spec.ts` | `E2E-SCHED-ACTIVE-002` | pending |
| `/[locale]/scheduler` | Next run earliest | mock `next_run` timestamps | Earliest timestamp shown; job name | `e2e/scheduler.spec.ts` | `E2E-SCHED-NEXT-003` | pending |
| `/[locale]/scheduler` | No timers | `jobs:[]` | "No systemd timers found." | `e2e/scheduler.spec.ts` | `E2E-SCHED-EMPTY-004` | pending |
| `/[locale]/scheduler` | Job row — Active | `enabled:true` | Default badge "Active" | `e2e/scheduler.spec.ts` | `E2E-SCHED-ROW-ACTIVE-005` | pending |
| `/[locale]/scheduler` | Job row — Inactive | `enabled:false` | Outline badge "Inactive" | `e2e/scheduler.spec.ts` | `E2E-SCHED-ROW-INACTIVE-006` | pending |
| `/[locale]/scheduler` | Loading state | 1s delay | "Loading…" centered | `e2e/scheduler.spec.ts` | `E2E-SCHED-LOADING-007` | pending |


---

<a id="15-alerts"></a>
## §15 Alerts

| Page | Action | Mock API Scenario | Expected Result | E2E Test File | Test ID | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `/[locale]/alerts` | Page load | `GET /api/alerts` (rules), `GET /api/alerts?history=1` (refetch 3s) | Header counts + Tabs (Timeline / History / Rules) | `e2e/alerts.spec.ts` | `E2E-ALERTS-001` | pending |
| `/[locale]/alerts` | Tab — Timeline | N/A | `<IncidentTimeline>` renders | `e2e/alerts.spec.ts` | `E2E-ALERTS-TAB-TIMELINE-002` | pending |
| `/[locale]/alerts` | Tab — History | N/A | DataTable with `ts/rule/svc/msg/st` | `e2e/alerts.spec.ts` | `E2E-ALERTS-TAB-HISTORY-003` | pending |
| `/[locale]/alerts` | Tab — Rules | N/A | DataTable of AlertRule with disabled Switch | `e2e/alerts.spec.ts` | `E2E-ALERTS-TAB-RULES-004` | pending |
| `/[locale]/alerts` | History search | N/A | Filters by ruleName/serviceName | `e2e/alerts.spec.ts` | `E2E-ALERTS-SEARCH-005` | pending |
| `/[locale]/alerts` | History sort — ts | N/A | Asc/desc | `e2e/alerts.spec.ts` | `E2E-ALERTS-SORT-006` | pending |
| `/[locale]/alerts` | History row badge — fired | red border | "fired" | `e2e/alerts.spec.ts` | `E2E-ALERTS-FIRED-007` | pending |
| `/[locale]/alerts` | History row badge — resolved | green border | "resolved" | `e2e/alerts.spec.ts` | `E2E-ALERTS-RESOLVED-008` | pending |
| `/[locale]/alerts` | Rules tab — Switch disabled | N/A | Switch is `disabled` (admin manages in /admin/alerts) | `e2e/alerts.spec.ts` | `E2E-ALERTS-SWITCH-009` | pending |
| `/[locale]/alerts` | Header — firing count | `history.filter(fired).length` | "N firing" copy | `e2e/alerts.spec.ts` | `E2E-ALERTS-HEADER-010` | pending |

---

<a id="16-approvals"></a>
## §16 Approvals

| Page | Action | Mock API Scenario | Expected Result | E2E Test File | Test ID | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `/[locale]/approvals` | Page load | `GET /api/approvals` → `{approvals:[]}` | Header + Tabs (Pending / Resolved) | `e2e/approvals.spec.ts` | `E2E-APPR-001` | pending |
| `/[locale]/approvals` | Tab — Pending | N/A | List of cards with `args_preview`, actor, time | `e2e/approvals.spec.ts` | `E2E-APPR-PENDING-002` | pending |
| `/[locale]/approvals` | Tab — Resolved | N/A | List with status badge + reason | `e2e/approvals.spec.ts` | `E2E-APPR-RESOLVED-003` | pending |
| `/[locale]/approvals` | Pending empty | `pending:[]` | "No pending approvals." | `e2e/approvals.spec.ts` | `E2E-APPR-PENDING-EMPTY-004` | pending |
| `/[locale]/approvals` | Approve (admin) | `POST /api/approvals {id, decision:"approve"}` → 200 | Toast "Request approved"; list refetches; row moves to Resolved | `e2e/approvals.spec.ts` | `E2E-APPR-APPROVE-005` | pending |
| `/[locale]/approvals` | Approve — server error | mock 400 `{error}` | Red toast | `e2e/approvals.spec.ts` | `E2E-APPR-APPROVE-ERR-006` | pending |
| `/[locale]/approvals` | Deny — open dialog | N/A | Dialog with reason `<Textarea>` | `e2e/approvals.spec.ts` | `E2E-APPR-DENY-OPEN-007` | pending |
| `/[locale]/approvals` | Deny — empty reason disables submit | N/A | Deny button disabled | `e2e/approvals.spec.ts` | `E2E-APPR-DENY-EMPTY-008` | pending |
| `/[locale]/approvals` | Deny — type reason + confirm | `POST /api/approvals {id, decision:"deny", reason}` → 200 | Dialog closes; toast "Request denied" | `e2e/approvals.spec.ts` | `E2E-APPR-DENY-CONFIRM-009` | pending |
| `/[locale]/approvals` | Deny — cancel | N/A | Dialog closes | `e2e/approvals.spec.ts` | `E2E-APPR-DENY-CANCEL-010` | pending |
| `/[locale]/approvals` | Standard user — no Approve/Deny | standard | Buttons not rendered | `e2e/approvals.spec.ts` | `E2E-APPR-DENY-USER-011` | pending |
| `/[locale]/approvals` | Header — pending count | mock count | "N pending" | `e2e/approvals.spec.ts` | `E2E-APPR-HEADER-012` | pending |

---

<a id="17-audit"></a>
## §17 Audit

| Page | Action | Mock API Scenario | Expected Result | E2E Test File | Test ID | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `/[locale]/audit` | Page load | `GET /api/audit` → `{rows:[]}` | Header "chain valid" badge + DataTable | `e2e/audit.spec.ts` | `E2E-AUDIT-001` | pending |
| `/[locale]/audit` | Search filter | N/A | Filters by actor/tool | `e2e/audit.spec.ts` | `E2E-AUDIT-SEARCH-002` | pending |
| `/[locale]/audit` | Sort by ts | N/A | Asc/desc | `e2e/audit.spec.ts` | `E2E-AUDIT-SORT-TS-003` | pending |
| `/[locale]/audit` | Sort by actor | N/A | Asc/desc | `e2e/audit.spec.ts` | `E2E-AUDIT-SORT-ACTOR-004` | pending |
| `/[locale]/audit` | Sort by decision | N/A | Asc/desc | `e2e/audit.spec.ts` | `E2E-AUDIT-SORT-DECISION-005` | pending |
| `/[locale]/audit` | Click row `view` | N/A | Right-side Sheet opens with full entry KV (id, actor, tool, class, decision, reason, result, hash, time) | `e2e/audit.spec.ts` | `E2E-AUDIT-DETAIL-006` | pending |
| `/[locale]/audit` | Close detail sheet | N/A | Sheet closes | `e2e/audit.spec.ts` | `E2E-AUDIT-DETAIL-CLOSE-007` | pending |
| `/[locale]/audit` | Decision badge — allow | green | "allow" | `e2e/audit.spec.ts` | `E2E-AUDIT-ALLOW-008` | pending |
| `/[locale]/audit` | Decision badge — deny | red | "deny" | `e2e/audit.spec.ts` | `E2E-AUDIT-DENY-009` | pending |
| `/[locale]/audit` | Header — entries count | mock `rows.length` | "N entries · hash-chained" | `e2e/audit.spec.ts` | `E2E-AUDIT-HEADER-010` | pending |

---

<a id="18-mail-guardian"></a>
## §18 Mail Guardian

| Page | Action | Mock API Scenario | Expected Result | E2E Test File | Test ID | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `/[locale]/mail-guardian` | Page load | `GET /api/mail-guardian/reviews` (refetch 5s) → `{reviews:[]}` | Header + left list + right detail panel | `e2e/mail.spec.ts` | `E2E-MAIL-001` | pending |
| `/[locale]/mail-guardian` | List empty | `reviews:[]` | "No reviews found." | `e2e/mail.spec.ts` | `E2E-MAIL-EMPTY-002` | pending |
| `/[locale]/mail-guardian` | Click review in list | N/A | Right panel populated; verdict + confidence shown | `e2e/mail.spec.ts` | `E2E-MAIL-SELECT-003` | pending |
| `/[locale]/mail-guardian` | Verdict badge — spam | red | "spam" | `e2e/mail.spec.ts` | `E2E-MAIL-VERDICT-SPAM-004` | pending |
| `/[locale]/mail-guardian` | Verdict badge — suspicious | yellow | "suspicious" | `e2e/mail.spec.ts` | `E2E-MAIL-VERDICT-SUSP-005` | pending |
| `/[locale]/mail-guardian` | Verdict badge — clean | green | "clean" / "legit" | `e2e/mail.spec.ts` | `E2E-MAIL-VERDICT-CLEAN-006` | pending |
| `/[locale]/mail-guardian` | Decision — Keep | `POST /api/mail-guardian/reviews {id, decision:"keep"}` → 200 | Toast "Decision recorded: keep"; list refetches | `e2e/mail.spec.ts` | `E2E-MAIL-KEEP-007` | pending |
| `/[locale]/mail-guardian` | Decision — Spam | mock 200 | Toast "Decision recorded: spam" | `e2e/mail.spec.ts` | `E2E-MAIL-SPAM-008` | pending |
| `/[locale]/mail-guardian` | Decision — Block sender | mock 200 | Toast "Decision recorded: block sender" | `e2e/mail.spec.ts` | `E2E-MAIL-BLOCK-009` | pending |
| `/[locale]/mail-guardian` | Decision — Allow sender | mock 200 | Toast "Decision recorded: allow sender" | `e2e/mail.spec.ts` | `E2E-MAIL-ALLOW-010` | pending |
| `/[locale]/mail-guardian` | Decision — server error | mock 400 `{error}` | Red toast | `e2e/mail.spec.ts` | `E2E-MAIL-ERR-011` | pending |
| `/[locale]/mail-guardian` | Decision buttons disabled when `queued_status:"done"` | mock done | Buttons `disabled` | `e2e/mail.spec.ts` | `E2E-MAIL-DONE-012` | pending |
| `/[locale]/mail-guardian` | Header — awaiting count | mock count | "N awaiting decision" | `e2e/mail.spec.ts` | `E2E-MAIL-HEADER-013` | pending |
| `/[locale]/mail-guardian` | Error state | mock 500 | Red error row | `e2e/mail.spec.ts` | `E2E-MAIL-ERR-RENDER-014` | pending |

---

<a id="19-agents"></a>
## §19 Agents

| Page | Action | Mock API Scenario | Expected Result | E2E Test File | Test ID | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `/[locale]/agents` | Page load | `GET /api/agents` → `{groups:[{project, agents:[{slug,name,files}]}]}` | 3-column grid: agent list + file tree + CodeBlock viewer | `e2e/agents.spec.ts` | `E2E-AGENTS-001` | pending |
| `/[locale]/agents` | Click agent | N/A — local state | File list filters; first file content shown in viewer | `e2e/agents.spec.ts` | `E2E-AGENTS-SELECT-002` | pending |
| `/[locale]/agents` | Click file | N/A | File content renders in `<CodeBlock>` | `e2e/agents.spec.ts` | `E2E-AGENTS-FILE-003` | pending |
| `/[locale]/agents` | Empty agents | `groups:[]` | Empty columns | `e2e/agents.spec.ts` | `E2E-AGENTS-EMPTY-004` | pending |
| `/[locale]/agents/[slug]` | Open detail | server-side `scanAgents()` returns agent | Header w/ project · model · files count + `<AgentFileViewer />` | `e2e/agents.spec.ts` | `E2E-AGENTS-DETAIL-005` | pending |
| `/[locale]/agents/[slug]` | Detail 404 | agent not found | `notFound()` → 404 page | `e2e/agents.spec.ts` | `E2E-AGENTS-DETAIL-404-006` | pending |
| `/[locale]/agents/[slug]` | Back link | N/A | Routes to `/agents` | `e2e/agents.spec.ts` | `E2E-AGENTS-DETAIL-BACK-007` | pending |
| `/[locale]/agents/[slug]` | File viewer — view file content | `GET /api/agents/<slug>/files?path=...` → file | CodeBlock renders with language badge | `e2e/agents.spec.ts` | `E2E-AGENTS-FILEVIEW-008` | pending |
| `/[locale]/agents/[slug]` | File viewer — read individual file | `GET /api/agents/<slug>/files/<filename>` → raw | Raw file content rendered | `e2e/agents.spec.ts` | `E2E-AGENTS-FILE-RAW-009` | pending |


---

<a id="20-admin-services"></a>
## §20 Admin · Services

| Page | Action | Mock API Scenario | Expected Result | E2E Test File | Test ID | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `/[locale]/admin/services` | Page load | `GET /api/admin/services?all=1` → `{services:[]}` | Header + DataTable | `e2e/admin-services.spec.ts` | `E2E-ADM-SVC-001` | pending |
| `/[locale]/admin/services` | Search filter | N/A | Filters by name/slug/category | `e2e/admin-services.spec.ts` | `E2E-ADM-SVC-SEARCH-002` | pending |
| `/[locale]/admin/services` | Sort by name | N/A | Asc/desc | `e2e/admin-services.spec.ts` | `E2E-ADM-SVC-SORT-003` | pending |
| `/[locale]/admin/services` | Sort by category | N/A | Asc/desc | `e2e/admin-services.spec.ts` | `E2E-ADM-SVC-SORT-CAT-004` | pending |
| `/[locale]/admin/services` | Sort by kind | N/A | Asc/desc | `e2e/admin-services.spec.ts` | `E2E-ADM-SVC-SORT-KIND-005` | pending |
| `/[locale]/admin/services` | Add service — open dialog | N/A | Dialog w/ empty form, slug editable | `e2e/admin-services.spec.ts` | `E2E-ADM-SVC-ADD-OPEN-006` | pending |
| `/[locale]/admin/services` | Add service — fill form + Save | `POST /api/admin/services {form}` → 200 | Dialog closes; toast "Created <name>"; row appears | `e2e/admin-services.spec.ts` | `E2E-ADM-SVC-ADD-SAVE-007` | pending |
| `/[locale]/admin/services` | Add service — Save in flight | mock with delay | Button text "Saving…"; disabled | `e2e/admin-services.spec.ts` | `E2E-ADM-SVC-ADD-PENDING-008` | pending |
| `/[locale]/admin/services` | Add service — server error | mock 400 `{error}` | Red toast | `e2e/admin-services.spec.ts` | `E2E-ADM-SVC-ADD-ERR-009` | pending |
| `/[locale]/admin/services` | Add service — Cancel | N/A | Dialog closes | `e2e/admin-services.spec.ts` | `E2E-ADM-SVC-ADD-CANCEL-010` | pending |
| `/[locale]/admin/services` | Edit service — open | N/A | Dialog w/ pre-filled form; slug disabled | `e2e/admin-services.spec.ts` | `E2E-ADM-SVC-EDIT-OPEN-011` | pending |
| `/[locale]/admin/services` | Edit service — Save | `PATCH /api/admin/services {form}` → 200 | Toast "Updated"; row updates | `e2e/admin-services.spec.ts` | `E2E-ADM-SVC-EDIT-SAVE-012` | pending |
| `/[locale]/admin/services` | Edit service — server error | mock 400 | Red toast | `e2e/admin-services.spec.ts` | `E2E-ADM-SVC-EDIT-ERR-013` | pending |
| `/[locale]/admin/services` | Delete service — open confirm | N/A | ConfirmDialog w/ `requireText=<slug>` | `e2e/admin-services.spec.ts` | `E2E-ADM-SVC-DEL-OPEN-014` | pending |
| `/[locale]/admin/services` | Delete service — wrong text | N/A | Confirm disabled | `e2e/admin-services.spec.ts` | `E2E-ADM-SVC-DEL-WRONG-015` | pending |
| `/[locale]/admin/services` | Delete service — confirm | `DELETE /api/admin/services?id=<id>` → 200 | Toast "Deleted"; row removed | `e2e/admin-services.spec.ts` | `E2E-ADM-SVC-DEL-CONFIRM-016` | pending |
| `/[locale]/admin/services` | Delete service — cancel | N/A | Dialog closes | `e2e/admin-services.spec.ts` | `E2E-ADM-SVC-DEL-CANCEL-017` | pending |
| `/[locale]/admin/services` | Delete service — server error | mock 400 | Red toast | `e2e/admin-services.spec.ts` | `E2E-ADM-SVC-DEL-ERR-018` | pending |
| `/[locale]/admin/services` | Health type select — `http` | N/A | Default selected | `e2e/admin-services.spec.ts` | `E2E-ADM-SVC-HT-HTTP-019` | pending |
| `/[locale]/admin/services` | Health type select — `tcp` | N/A | "tcp" | `e2e/admin-services.spec.ts` | `E2E-ADM-SVC-HT-TCP-020` | pending |
| `/[locale]/admin/services` | Health type select — `docker` | N/A | "docker" | `e2e/admin-services.spec.ts` | `E2E-ADM-SVC-HT-DOCKER-021` | pending |
| `/[locale]/admin/services` | Health type select — `systemd` | N/A | "systemd" | `e2e/admin-services.spec.ts` | `E2E-ADM-SVC-HT-SYSTEMD-022` | pending |
| `/[locale]/admin/services` | Health type select — `process` | N/A | "process" | `e2e/admin-services.spec.ts` | `E2E-ADM-SVC-HT-PROCESS-023` | pending |
| `/[locale]/admin/services` | Standard user denied | standard | 403 / no edit actions | `e2e/admin-services.spec.ts` | `E2E-ADM-SVC-DENY-024` | pending |
| `/[locale]/admin/services` | Active column shows Yes/No | mock `is_active:true/false` | Default vs Secondary badge | `e2e/admin-services.spec.ts` | `E2E-ADM-SVC-ACTIVE-025` | pending |

---

<a id="21-admin-badges"></a>
## §21 Admin · Badges

| Page | Action | Mock API Scenario | Expected Result | E2E Test File | Test ID | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `/[locale]/admin/badges` | Page load | `GET /api/badges` → `{badges:[]}` | Header + DataTable w/ Preview column | `e2e/admin-badges.spec.ts` | `E2E-ADM-BDG-001` | pending |
| `/[locale]/admin/badges` | Search filter | N/A | Filters by slug/label | `e2e/admin-badges.spec.ts` | `E2E-ADM-BDG-SEARCH-002` | pending |
| `/[locale]/admin/badges` | Sort by slug | N/A | Asc/desc | `e2e/admin-badges.spec.ts` | `E2E-ADM-BDG-SORT-SLUG-003` | pending |
| `/[locale]/admin/badges` | Sort by label | N/A | Asc/desc | `e2e/admin-badges.spec.ts` | `E2E-ADM-BDG-SORT-LABEL-004` | pending |
| `/[locale]/admin/badges` | New badge — open | N/A | Dialog w/ empty form | `e2e/admin-badges.spec.ts` | `E2E-ADM-BDG-NEW-OPEN-005` | pending |
| `/[locale]/admin/badges` | New badge — fill + Create | `POST /api/badges {form}` → 200 | Dialog closes; toast "Badge created" | `e2e/admin-badges.spec.ts` | `E2E-ADM-BDG-NEW-SAVE-006` | pending |
| `/[locale]/admin/badges` | New badge — empty slug/label | N/A | Create button disabled | `e2e/admin-badges.spec.ts` | `E2E-ADM-BDG-NEW-INVALID-007` | pending |
| `/[locale]/admin/badges` | New badge — server error | mock 400 | Red toast | `e2e/admin-badges.spec.ts` | `E2E-ADM-BDG-NEW-ERR-008` | pending |
| `/[locale]/admin/badges` | Edit badge — open | N/A | Dialog w/ pre-filled form; slug disabled | `e2e/admin-badges.spec.ts` | `E2E-ADM-BDG-EDIT-OPEN-009` | pending |
| `/[locale]/admin/badges` | Edit badge — Save | `PUT /api/badges?slug=<slug>` → 200 | Dialog closes; toast "Badge updated" | `e2e/admin-badges.spec.ts` | `E2E-ADM-BDG-EDIT-SAVE-010` | pending |
| `/[locale]/admin/badges` | Edit badge — server error | mock 400 | Red toast | `e2e/admin-badges.spec.ts` | `E2E-ADM-BDG-EDIT-ERR-011` | pending |
| `/[locale]/admin/badges` | Delete badge — confirm | `DELETE /api/badges?slug=<slug>` → 200 | Toast; row removed | `e2e/admin-badges.spec.ts` | `E2E-ADM-BDG-DEL-CONFIRM-012` | pending |
| `/[locale]/admin/badges` | Delete badge — server error | mock 400 | Red toast | `e2e/admin-badges.spec.ts` | `E2E-ADM-BDG-DEL-ERR-013` | pending |
| `/[locale]/admin/badges` | Color picker — change color | N/A | `input[type=color]` updates; preview swatch updates | `e2e/admin-badges.spec.ts` | `E2E-ADM-BDG-COLOR-014` | pending |
| `/[locale]/admin/badges` | Text color picker | N/A | Preview text color updates | `e2e/admin-badges.spec.ts` | `E2E-ADM-BDG-TEXT-015` | pending |
| `/[locale]/admin/badges` | Preview badge live update | edit label | Preview chip updates with new label + colors | `e2e/admin-badges.spec.ts` | `E2E-ADM-BDG-PREVIEW-016` | pending |
| `/[locale]/admin/badges` | Standard user denied | standard | Page 403 / no actions | `e2e/admin-badges.spec.ts` | `E2E-ADM-BDG-DENY-017` | pending |


---

<a id="22-admin-env-browser"></a>
## §22 Admin · Env Browser

| Page | Action | Mock API Scenario | Expected Result | E2E Test File | Test ID | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `/[locale]/admin/env-browser` | Page load (default path) | `GET /api/env-browser?path=/opt/cortexos/.secrets/9router.env` → `{path,lines}` | Sidebar shows file + KV list of keys | `e2e/admin-env.spec.ts` | `E2E-ADM-ENV-001` | pending |
| `/[locale]/admin/env-browser` | Load new path | `GET /api/env-browser?path=...` | Sidebar updates; KV list updates | `e2e/admin-env.spec.ts` | `E2E-ADM-ENV-LOAD-002` | pending |
| `/[locale]/admin/env-browser` | Load path — server 404 | mock 404 `{error}` | Red error message | `e2e/admin-env.spec.ts` | `E2E-ADM-ENV-LOAD-404-003` | pending |
| `/[locale]/admin/env-browser` | Load path — server 500 | mock 500 | Red error | `e2e/admin-env.spec.ts` | `E2E-ADM-ENV-LOAD-500-004` | pending |
| `/[locale]/admin/env-browser` | Empty file | `lines:[]` | "No keys in this file." | `e2e/admin-env.spec.ts` | `E2E-ADM-ENV-EMPTY-005` | pending |
| `/[locale]/admin/env-browser` | Secret key (masked) | `masked:"****"` | Bullets shown; reveal button present | `e2e/admin-env.spec.ts` | `E2E-ADM-ENV-SECRET-006` | pending |
| `/[locale]/admin/env-browser` | Secret key — toggle reveal | N/A (client-only) | Shows "(reveal requires confirmation)" — no cleartext via UI | `e2e/admin-env.spec.ts` | `E2E-ADM-ENV-REVEAL-007` | pending |
| `/[locale]/admin/env-browser` | Non-secret key | `value:"some-value"`, no `masked` | Plain value shown; reveal button hides value when toggled | `e2e/admin-env.spec.ts` | `E2E-ADM-ENV-NONSECRET-008` | pending |
| `/[locale]/admin/env-browser` | Copy value — success | `navigator.clipboard.writeText` resolves | Toast "Copied <key>" | `e2e/admin-env.spec.ts` | `E2E-ADM-ENV-COPY-009` | pending |
| `/[locale]/admin/env-browser` | Copy value — clipboard reject | mock reject | Red toast "Could not copy" | `e2e/admin-env.spec.ts` | `E2E-ADM-ENV-COPY-ERR-010` | pending |
| `/[locale]/admin/env-browser` | No file loaded | initial state | Sidebar "No file loaded" | `e2e/admin-env.spec.ts` | `E2E-ADM-ENV-NOFILE-011` | pending |
| `/[locale]/admin/env-browser` | Standard user denied | standard | Page 403 | `e2e/admin-env.spec.ts` | `E2E-ADM-ENV-DENY-012` | pending |
| `/[locale]/admin/env-browser` | Loading state | 1s delay | "Loading…" copy | `e2e/admin-env.spec.ts` | `E2E-ADM-ENV-LOADING-013` | pending |

---

<a id="23-admin-systemd"></a>
## §23 Admin · Systemd

| Page | Action | Mock API Scenario | Expected Result | E2E Test File | Test ID | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `/[locale]/admin/systemd` | Page load | `GET /api/systemd` → `{services:[]}` | Header + DataTable | `e2e/admin-systemd.spec.ts` | `E2E-ADM-SD-001` | pending |
| `/[locale]/admin/systemd` | Search filter | N/A | Filters by name/description | `e2e/admin-systemd.spec.ts` | `E2E-ADM-SD-SEARCH-002` | pending |
| `/[locale]/admin/systemd` | Sort by name | N/A | Asc/desc | `e2e/admin-systemd.spec.ts` | `E2E-ADM-SD-SORT-003` | pending |
| `/[locale]/admin/systemd` | Sort by active | N/A | Asc/desc | `e2e/admin-systemd.spec.ts` | `E2E-ADM-SD-SORT-ACTIVE-004` | pending |
| `/[locale]/admin/systemd` | Start (admin) | `POST /api/systemd/actions {action:"start",name}` → 200 | Toast "Started"; refetch | `e2e/admin-systemd.spec.ts` | `E2E-ADM-SD-START-005` | pending |
| `/[locale]/admin/systemd` | Stop — open confirm | N/A | ConfirmDialog w/ destructive style | `e2e/admin-systemd.spec.ts` | `E2E-ADM-SD-STOP-OPEN-006` | pending |
| `/[locale]/admin/systemd` | Stop — confirm | `POST /api/systemd/actions {action:"stop",name}` → 200 | Toast; refetch | `e2e/admin-systemd.spec.ts` | `E2E-ADM-SD-STOP-CONFIRM-007` | pending |
| `/[locale]/admin/systemd` | Stop — cancel | N/A | Dialog closes | `e2e/admin-systemd.spec.ts` | `E2E-ADM-SD-STOP-CANCEL-008` | pending |
| `/[locale]/admin/systemd` | Restart (admin) | `POST /api/systemd/actions {action:"restart",name}` → 200 | Toast "Restarted" | `e2e/admin-systemd.spec.ts` | `E2E-ADM-SD-RESTART-009` | pending |
| `/[locale]/admin/systemd` | Action — server 500 | mock 500 | Red toast | `e2e/admin-systemd.spec.ts` | `E2E-ADM-SD-ERR-500-010` | pending |
| `/[locale]/admin/systemd` | Action — server 400 | mock 400 | Red toast w/ `body.error` | `e2e/admin-systemd.spec.ts` | `E2E-ADM-SD-ERR-400-011` | pending |
| `/[locale]/admin/systemd` | Standard user denied | standard | 403 / no actions | `e2e/admin-systemd.spec.ts` | `E2E-ADM-SD-DENY-012` | pending |
| `/[locale]/admin/systemd` | Header — failed count | mock `active:"failed"` | "M failed" in description | `e2e/admin-systemd.spec.ts` | `E2E-ADM-SD-HEADER-013` | pending |

---

<a id="24-admin-docker"></a>
## §24 Admin · Docker

| Page | Action | Mock API Scenario | Expected Result | E2E Test File | Test ID | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `/[locale]/admin/docker` | Page load | `GET /api/docker` (refetch 5s) | Header + DataTable | `e2e/admin-docker.spec.ts` | `E2E-ADM-DK-001` | pending |
| `/[locale]/admin/docker` | Search filter | N/A | Filters by name/image | `e2e/admin-docker.spec.ts` | `E2E-ADM-DK-SEARCH-002` | pending |
| `/[locale]/admin/docker` | Sort by name | N/A | Asc/desc | `e2e/admin-docker.spec.ts` | `E2E-ADM-DK-SORT-NAME-003` | pending |
| `/[locale]/admin/docker` | Sort by state | N/A | Asc/desc | `e2e/admin-docker.spec.ts` | `E2E-ADM-DK-SORT-STATE-004` | pending |
| `/[locale]/admin/docker` | Start (admin) | `POST /api/docker/actions {action:"start",name}` → 200 | Toast "Started" | `e2e/admin-docker.spec.ts` | `E2E-ADM-DK-START-005` | pending |
| `/[locale]/admin/docker` | Stop (admin) | `POST /api/docker/actions {action:"stop",name}` → 200 | Toast "Stopped" | `e2e/admin-docker.spec.ts` | `E2E-ADM-DK-STOP-006` | pending |
| `/[locale]/admin/docker` | Restart (admin) | `POST /api/docker/actions {action:"restart",name}` → 200 | Toast "Restarted" | `e2e/admin-docker.spec.ts` | `E2E-ADM-DK-RESTART-007` | pending |
| `/[locale]/admin/docker` | Action — server error | mock 500 | Red toast | `e2e/admin-docker.spec.ts` | `E2E-ADM-DK-ERR-008` | pending |
| `/[locale]/admin/docker` | Remove — open confirm | N/A | ConfirmDialog w/ `requireText=<name>` | `e2e/admin-docker.spec.ts` | `E2E-ADM-DK-REMOVE-OPEN-009` | pending |
| `/[locale]/admin/docker` | Remove — type + confirm | N/A (currently surfaces "Container removal is not available" error) | Red toast — feature not yet implemented; test asserts current contract | `e2e/admin-docker.spec.ts` | `E2E-ADM-DK-REMOVE-CONFIRM-010` | pending |
| `/[locale]/admin/docker` | Remove — cancel | N/A | Dialog closes | `e2e/admin-docker.spec.ts` | `E2E-ADM-DK-REMOVE-CANCEL-011` | pending |
| `/[locale]/admin/docker` | Standard user denied | standard | 403 / no actions | `e2e/admin-docker.spec.ts` | `E2E-ADM-DK-DENY-012` | pending |
| `/[locale]/admin/docker` | Header — running count | mock state | "N running" in description | `e2e/admin-docker.spec.ts` | `E2E-ADM-DK-HEADER-013` | pending |

---

<a id="25-admin-alerts"></a>
## §25 Admin · Alerts

| Page | Action | Mock API Scenario | Expected Result | E2E Test File | Test ID | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `/[locale]/admin/alerts` | Page load | `GET /api/alerts` (rules) | Header + DataTable w/ Switch column | `e2e/admin-alerts.spec.ts` | `E2E-ADM-ALT-001` | pending |
| `/[locale]/admin/alerts` | Search filter | N/A | Filters by name | `e2e/admin-alerts.spec.ts` | `E2E-ADM-ALT-SEARCH-002` | pending |
| `/[locale]/admin/alerts` | Sort by name | N/A | Asc/desc | `e2e/admin-alerts.spec.ts` | `E2E-ADM-ALT-SORT-NAME-003` | pending |
| `/[locale]/admin/alerts` | Sort by service_id | N/A | Asc/desc | `e2e/admin-alerts.spec.ts` | `E2E-ADM-ALT-SORT-SVC-004` | pending |
| `/[locale]/admin/alerts` | Sort by condition | N/A | Asc/desc | `e2e/admin-alerts.spec.ts` | `E2E-ADM-ALT-SORT-COND-005` | pending |
| `/[locale]/admin/alerts` | New rule — open dialog | N/A | Dialog w/ name, service_id, condition, threshold_ms | `e2e/admin-alerts.spec.ts` | `E2E-ADM-ALT-NEW-OPEN-006` | pending |
| `/[locale]/admin/alerts` | New rule — condition `response_time` enables threshold | N/A | Threshold input enabled | `e2e/admin-alerts.spec.ts` | `E2E-ADM-ALT-NEW-THRESH-007` | pending |
| `/[locale]/admin/alerts` | New rule — condition `offline` disables threshold | N/A | Threshold input disabled | `e2e/admin-alerts.spec.ts` | `E2E-ADM-ALT-NEW-THRESH-DIS-008` | pending |
| `/[locale]/admin/alerts` | New rule — empty name | N/A | Toast error "Name and a numeric Service ID are required" | `e2e/admin-alerts.spec.ts` | `E2E-ADM-ALT-NEW-EMPTY-009` | pending |
| `/[locale]/admin/alerts` | New rule — non-numeric service_id | N/A | Same toast error | `e2e/admin-alerts.spec.ts` | `E2E-ADM-ALT-NEW-BADID-010` | pending |
| `/[locale]/admin/alerts` | New rule — valid submit | `POST /api/alerts {rule}` → 200 | Dialog closes; row appears | `e2e/admin-alerts.spec.ts` | `E2E-ADM-ALT-NEW-SAVE-011` | pending |
| `/[locale]/admin/alerts` | New rule — server error | mock 400 | Red toast | `e2e/admin-alerts.spec.ts` | `E2E-ADM-ALT-NEW-ERR-012` | pending |
| `/[locale]/admin/alerts` | New rule — Submit pending | 1s delay | Button disabled | `e2e/admin-alerts.spec.ts` | `E2E-ADM-ALT-NEW-PENDING-013` | pending |
| `/[locale]/admin/alerts` | Toggle rule | `PATCH /api/alerts {id, enabled:!enabled}` → 200 | Switch flips; refetch | `e2e/admin-alerts.spec.ts` | `E2E-ADM-ALT-TOGGLE-014` | pending |
| `/[locale]/admin/alerts` | Toggle — server error | mock 400 | Red toast | `e2e/admin-alerts.spec.ts` | `E2E-ADM-ALT-TOGGLE-ERR-015` | pending |
| `/[locale]/admin/alerts` | Delete — confirm | `DELETE /api/alerts?id=<id>` → 200 | Toast; row removed | `e2e/admin-alerts.spec.ts` | `E2E-ADM-ALT-DEL-016` | pending |
| `/[locale]/admin/alerts` | Delete — server error | mock 400 | Red toast | `e2e/admin-alerts.spec.ts` | `E2E-ADM-ALT-DEL-ERR-017` | pending |
| `/[locale]/admin/alerts` | Standard user denied | standard | 403 / no actions | `e2e/admin-alerts.spec.ts` | `E2E-ADM-ALT-DENY-018` | pending |

---

<a id="26-admin-users"></a>
## §26 Admin · Users

| Page | Action | Mock API Scenario | Expected Result | E2E Test File | Test ID | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `/[locale]/admin/users` | Page load | `GET /api/admin/users` → `{users:[]}` | Header + DataTable (read-only — PAM-backed) | `e2e/admin-users.spec.ts` | `E2E-ADM-USR-001` | pending |
| `/[locale]/admin/users` | Search filter | N/A | Filters by username | `e2e/admin-users.spec.ts` | `E2E-ADM-USR-SEARCH-002` | pending |
| `/[locale]/admin/users` | Sort by username | N/A | Asc/desc | `e2e/admin-users.spec.ts` | `E2E-ADM-USR-SORT-USERNAME-003` | pending |
| `/[locale]/admin/users` | Sort by last_login_at | N/A | Asc/desc | `e2e/admin-users.spec.ts` | `E2E-ADM-USR-SORT-LAST-004` | pending |
| `/[locale]/admin/users` | Sort by active_sessions | N/A | Asc/desc | `e2e/admin-users.spec.ts` | `E2E-ADM-USR-SORT-SESSIONS-005` | pending |
| `/[locale]/admin/users` | Active sessions badge > 0 | mock count 3 | Default badge "3" | `e2e/admin-users.spec.ts` | `E2E-ADM-USR-SESSIONS-006` | pending |
| `/[locale]/admin/users` | Active sessions badge = 0 | mock count 0 | Outline badge "0" | `e2e/admin-users.spec.ts` | `E2E-ADM-USR-SESSIONS-ZERO-007` | pending |
| `/[locale]/admin/users` | Mutate POST 405 (PAM gate) | `POST /api/admin/users` → 405 | Confirms no in-app create; UI surfaces no buttons (assert no create button) | `e2e/admin-users.spec.ts` | `E2E-ADM-USR-NO-MUTATE-008` | pending |
| `/[locale]/admin/users` | Empty users | `users:[]` | "No results" | `e2e/admin-users.spec.ts` | `E2E-ADM-USR-EMPTY-009` | pending |
| `/[locale]/admin/users` | First seen / last login render | mock ISO timestamps | Locale-formatted date+time | `e2e/admin-users.spec.ts` | `E2E-ADM-USR-DATE-010` | pending |


---

<a id="27-admin-projects"></a>
## §27 Admin · Projects

| Page | Action | Mock API Scenario | Expected Result | E2E Test File | Test ID | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `/[locale]/admin/projects` | Page load | `GET /api/projects` → `{projects:[]}` | Header + DataTable | `e2e/admin-projects.spec.ts` | `E2E-ADM-PRJ-001` | pending |
| `/[locale]/admin/projects` | Search filter | N/A | Filters by name/slug | `e2e/admin-projects.spec.ts` | `E2E-ADM-PRJ-SEARCH-002` | pending |
| `/[locale]/admin/projects` | Sort by name | N/A | Asc/desc | `e2e/admin-projects.spec.ts` | `E2E-ADM-PRJ-SORT-NAME-003` | pending |
| `/[locale]/admin/projects` | Sort by created_at | N/A | Asc/desc | `e2e/admin-projects.spec.ts` | `E2E-ADM-PRJ-SORT-CREATED-004` | pending |
| `/[locale]/admin/projects` | New project — open | N/A | Dialog w/ empty form (slug editable) | `e2e/admin-projects.spec.ts` | `E2E-ADM-PRJ-NEW-OPEN-005` | pending |
| `/[locale]/admin/projects` | New project — empty name/slug | N/A | Toast error "Slug and name are required" | `e2e/admin-projects.spec.ts` | `E2E-ADM-PRJ-NEW-EMPTY-006` | pending |
| `/[locale]/admin/projects` | New project — valid submit | `POST /api/projects {form}` → 200 | Dialog closes; row appears | `e2e/admin-projects.spec.ts` | `E2E-ADM-PRJ-NEW-SAVE-007` | pending |
| `/[locale]/admin/projects` | New project — server error | mock 400 | Red toast | `e2e/admin-projects.spec.ts` | `E2E-ADM-PRJ-NEW-ERR-008` | pending |
| `/[locale]/admin/projects` | New project — Cancel | N/A | Dialog closes | `e2e/admin-projects.spec.ts` | `E2E-ADM-PRJ-NEW-CANCEL-009` | pending |
| `/[locale]/admin/projects` | Edit — open | N/A | Dialog w/ pre-filled form; slug disabled | `e2e/admin-projects.spec.ts` | `E2E-ADM-PRJ-EDIT-OPEN-010` | pending |
| `/[locale]/admin/projects` | Edit — Save | `PUT /api/projects?slug=<slug>` → 200 | Toast "Project updated" | `e2e/admin-projects.spec.ts` | `E2E-ADM-PRJ-EDIT-SAVE-011` | pending |
| `/[locale]/admin/projects` | Edit — server error | mock 400 | Red toast | `e2e/admin-projects.spec.ts` | `E2E-ADM-PRJ-EDIT-ERR-012` | pending |
| `/[locale]/admin/projects` | Delete — open confirm | N/A | ConfirmDialog w/ `requireText=<slug>` | `e2e/admin-projects.spec.ts` | `E2E-ADM-PRJ-DEL-OPEN-013` | pending |
| `/[locale]/admin/projects` | Delete — wrong text | N/A | Confirm disabled | `e2e/admin-projects.spec.ts` | `E2E-ADM-PRJ-DEL-WRONG-014` | pending |
| `/[locale]/admin/projects` | Delete — confirm | `DELETE /api/projects?slug=<slug>` → 200 | Toast; row removed | `e2e/admin-projects.spec.ts` | `E2E-ADM-PRJ-DEL-CONFIRM-015` | pending |
| `/[locale]/admin/projects` | Delete — cancel | N/A | Dialog closes | `e2e/admin-projects.spec.ts` | `E2E-ADM-PRJ-DEL-CANCEL-016` | pending |
| `/[locale]/admin/projects` | Messaging mode — `single` | N/A | Default | `e2e/admin-projects.spec.ts` | `E2E-ADM-PRJ-MODE-SINGLE-017` | pending |
| `/[locale]/admin/projects` | Messaging mode — `distributed` | N/A | Selected in Select | `e2e/admin-projects.spec.ts` | `E2E-ADM-PRJ-MODE-DIST-018` | pending |
| `/[locale]/admin/projects` | Repo URL — open external | N/A | `target="_blank"` link | `e2e/admin-projects.spec.ts` | `E2E-ADM-PRJ-REPO-019` | pending |
| `/[locale]/admin/projects` | Standard user denied | standard | 403 | `e2e/admin-projects.spec.ts` | `E2E-ADM-PRJ-DENY-020` | pending |
| `/[locale]/admin/projects` | Routes per project | `GET /api/projects/<slug>/routes` → list | Routes panel (when present) | `e2e/admin-projects.spec.ts` | `E2E-ADM-PRJ-ROUTES-021` | pending |

---

<a id="28-admin-incus"></a>
## §28 Admin · Incus

| Page | Action | Mock API Scenario | Expected Result | E2E Test File | Test ID | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `/[locale]/admin/incus` | Page load | `GET /api/incus` → `{data:[]}` (refetch 5s) | Header + DataTable | `e2e/admin-incus.spec.ts` | `E2E-ADM-INC-001` | pending |
| `/[locale]/admin/incus` | Search filter | N/A | Filters by name/arch | `e2e/admin-incus.spec.ts` | `E2E-ADM-INC-SEARCH-002` | pending |
| `/[locale]/admin/incus` | Sort by name | N/A | Asc/desc | `e2e/admin-incus.spec.ts` | `E2E-ADM-INC-SORT-NAME-003` | pending |
| `/[locale]/admin/incus` | Sort by arch | N/A | Asc/desc | `e2e/admin-incus.spec.ts` | `E2E-ADM-INC-SORT-ARCH-004` | pending |
| `/[locale]/admin/incus` | Sort by snapshotsCount | N/A | Asc/desc | `e2e/admin-incus.spec.ts` | `E2E-ADM-INC-SORT-SNAPS-005` | pending |
| `/[locale]/admin/incus` | Start (admin) | `POST /api/incus/actions {action:"start",name}` → 200 | Toast "Started" | `e2e/admin-incus.spec.ts` | `E2E-ADM-INC-START-006` | pending |
| `/[locale]/admin/incus` | Stop (admin) | `POST /api/incus/actions {action:"stop",name}` → 200 | Toast "Stopped" | `e2e/admin-incus.spec.ts` | `E2E-ADM-INC-STOP-007` | pending |
| `/[locale]/admin/incus` | Restart (admin) | `POST /api/incus/actions {action:"restart",name}` → 200 | Toast "Restarted" | `e2e/admin-incus.spec.ts` | `E2E-ADM-INC-RESTART-008` | pending |
| `/[locale]/admin/incus` | Delete — open confirm | N/A | ConfirmDialog w/ `requireText=<name>` | `e2e/admin-incus.spec.ts` | `E2E-ADM-INC-DEL-OPEN-009` | pending |
| `/[locale]/admin/incus` | Delete — wrong text | N/A | Confirm disabled | `e2e/admin-incus.spec.ts` | `E2E-ADM-INC-DEL-WRONG-010` | pending |
| `/[locale]/admin/incus` | Delete — confirm | `POST /api/incus/actions {action:"delete",name}` with `x-incus-delete-confirm: true` → 200 | Toast "Deleted" | `e2e/admin-incus.spec.ts` | `E2E-ADM-INC-DEL-CONFIRM-011` | pending |
| `/[locale]/admin/incus` | Delete — missing confirm header | mock 400 | Red toast | `e2e/admin-incus.spec.ts` | `E2E-ADM-INC-DEL-NO-HEADER-012` | pending |
| `/[locale]/admin/incus` | Delete — cancel | N/A | Dialog closes | `e2e/admin-incus.spec.ts` | `E2E-ADM-INC-DEL-CANCEL-013` | pending |
| `/[locale]/admin/incus` | Action — server 500 | mock 500 | Red toast | `e2e/admin-incus.spec.ts` | `E2E-ADM-INC-ERR-500-014` | pending |
| `/[locale]/admin/incus` | Standard user denied | standard | 403 / no actions | `e2e/admin-incus.spec.ts` | `E2E-ADM-INC-DENY-015` | pending |
| `/[locale]/admin/incus` | Status badge — running | `status:"running"` | Default badge | `e2e/admin-incus.spec.ts` | `E2E-ADM-INC-STATUS-RUN-016` | pending |
| `/[locale]/admin/incus` | Status badge — stopped | `status:"stopped"` | Destructive badge | `e2e/admin-incus.spec.ts` | `E2E-ADM-INC-STATUS-STOP-017` | pending |
| `/[locale]/admin/incus` | Status badge — other | `status:"other"` | Secondary badge | `e2e/admin-incus.spec.ts` | `E2E-ADM-INC-STATUS-OTHER-018` | pending |

---

<a id="29-admin-audit-log"></a>
## §29 Admin · Audit Log

| Page | Action | Mock API Scenario | Expected Result | E2E Test File | Test ID | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `/[locale]/admin/audit` | Page load | `GET /api/audit` (refetch 10s) | Header + DataTable | `e2e/admin-audit.spec.ts` | `E2E-ADM-AUD-001` | pending |
| `/[locale]/admin/audit` | Search filter | N/A | Filters by actor/tool | `e2e/admin-audit.spec.ts` | `E2E-ADM-AUD-SEARCH-002` | pending |
| `/[locale]/admin/audit` | Sort by created_at | N/A | Asc/desc | `e2e/admin-audit.spec.ts` | `E2E-ADM-AUD-SORT-003` | pending |
| `/[locale]/admin/audit` | Sort by actor | N/A | Asc/desc | `e2e/admin-audit.spec.ts` | `E2E-ADM-AUD-SORT-ACTOR-004` | pending |
| `/[locale]/admin/audit` | Decision badge — allow | mock `decision:"allow"` | Default badge | `e2e/admin-audit.spec.ts` | `E2E-ADM-AUD-ALLOW-005` | pending |
| `/[locale]/admin/audit` | Decision badge — deny | mock `decision:"deny"` | Destructive badge | `e2e/admin-audit.spec.ts` | `E2E-ADM-AUD-DENY-006` | pending |
| `/[locale]/admin/audit` | Export JSON | client-side blob | Downloads `audit-YYYY-MM-DD.json`; toast "Exported N entries" | `e2e/admin-audit.spec.ts` | `E2E-ADM-AUD-EXPORT-007` | pending |
| `/[locale]/admin/audit` | Args hash slice 0..10 | mock `args_hash` | First 10 chars + ellipsis | `e2e/admin-audit.spec.ts` | `E2E-ADM-AUD-HASH-008` | pending |
| `/[locale]/admin/audit` | Header — entries count | mock `rows.length` | "N entries · tamper-evident" | `e2e/admin-audit.spec.ts` | `E2E-ADM-AUD-HEADER-009` | pending |
| `/[locale]/admin/audit` | Chain verify badge | `GET /api/audit/verify?from=...&to=...` → 200 `{valid:true,count:N}` | "chain: ok (N)" badge | `e2e/admin-audit.spec.ts` | `E2E-ADM-AUD-CHAIN-OK-010` | pending |
| `/[locale]/admin/audit` | Chain verify — broken | mock `{valid:false, brokenAt:{id,reason}}` | "chain: BROKEN @ id N" badge w/ tooltip reason | `e2e/admin-audit.spec.ts` | `E2E-ADM-AUD-CHAIN-BROKEN-011` | pending |
| `/[locale]/admin/audit` | Chain verify — error | mock HTTP 500 | "chain: error (...)" badge | `e2e/admin-audit.spec.ts` | `E2E-ADM-AUD-CHAIN-ERR-012` | pending |
| `/[locale]/admin/audit` | Standard user denied | standard | 403 | `e2e/admin-audit.spec.ts` | `E2E-ADM-AUD-DENY-013` | pending |
| `/[locale]/admin/audit` | Empty audit | `rows:[]` | "No results" in table | `e2e/admin-audit.spec.ts` | `E2E-ADM-AUD-EMPTY-014` | pending |

---

<a id="30-admin-account"></a>
## §30 Admin · Account

| Page | Action | Mock API Scenario | Expected Result | E2E Test File | Test ID | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `/[locale]/admin/account` | Page load | Mocks `useAuth` `{username,is_admin}` | 4 cards: Profile, Security, Notifications, Appearance | `e2e/admin-account.spec.ts` | `E2E-ADM-ACC-001` | pending |
| `/[locale]/admin/account` | Profile — Username read-only | N/A | `<Input readOnly>` with username | `e2e/admin-account.spec.ts` | `E2E-ADM-ACC-USERNAME-002` | pending |
| `/[locale]/admin/account` | Profile — Edit email | N/A | `<Input>` value changes; Save enables | `e2e/admin-account.spec.ts` | `E2E-ADM-ACC-EMAIL-003` | pending |
| `/[locale]/admin/account` | Profile — Save | N/A (local toast) | Toast "Profile saved" | `e2e/admin-account.spec.ts` | `E2E-ADM-ACC-SAVE-004` | pending |
| `/[locale]/admin/account` | Security — empty currentPw submit | N/A | "Update password" disabled / no-op (current spec: button is enabled, server validates) | `e2e/admin-account.spec.ts` | `E2E-ADM-ACC-PW-EMPTY-005` | pending |
| `/[locale]/admin/account` | Security — submit valid pw | `POST /api/auth/password {currentPassword, newPassword}` → 200 `{message}` | Toast "Password updated"; inputs cleared | `e2e/admin-account.spec.ts` | `E2E-ADM-ACC-PW-OK-006` | pending |
| `/[locale]/admin/account` | Security — submit invalid pw | mock 400 `{error}` | Red toast | `e2e/admin-account.spec.ts` | `E2E-ADM-ACC-PW-ERR-007` | pending |
| `/[locale]/admin/account` | Security — network error | mock network reject | Red toast "Network error while updating password" | `e2e/admin-account.spec.ts` | `E2E-ADM-ACC-PW-NET-008` | pending |
| `/[locale]/admin/account` | Security — submit pending | mock delay | Button disabled | `e2e/admin-account.spec.ts` | `E2E-ADM-ACC-PW-PENDING-009` | pending |
| `/[locale]/admin/account` | Notifications — toggle `email` | N/A | Switch flips; toast "email on/off" | `e2e/admin-account.spec.ts` | `E2E-ADM-ACC-NOTIF-EMAIL-010` | pending |
| `/[locale]/admin/account` | Notifications — toggle `push` | N/A | Switch flips; toast | `e2e/admin-account.spec.ts` | `E2E-ADM-ACC-NOTIF-PUSH-011` | pending |
| `/[locale]/admin/account` | Notifications — toggle `digest` | N/A | Switch flips; toast | `e2e/admin-account.spec.ts` | `E2E-ADM-ACC-NOTIF-DIGEST-012` | pending |
| `/[locale]/admin/account` | Appearance — Theme `dark` | N/A | Mode set; `<html class="dark">` | `e2e/admin-account.spec.ts` | `E2E-ADM-ACC-THEME-DARK-013` | pending |
| `/[locale]/admin/account` | Appearance — Theme `light` | N/A | Mode set; `<html class="light">` | `e2e/admin-account.spec.ts` | `E2E-ADM-ACC-THEME-LIGHT-014` | pending |
| `/[locale]/admin/account` | Appearance — Accent `cortex` | N/A | `<html class="theme-cortex">`; cookie `cortex-preset=cortex` | `e2e/admin-account.spec.ts` | `E2E-ADM-ACC-ACCENT-CORTEX-015` | pending |
| `/[locale]/admin/account` | Appearance — Accent `teal` | N/A | `<html class="theme-teal">`; cookie | `e2e/admin-account.spec.ts` | `E2E-ADM-ACC-ACCENT-TEAL-016` | pending |
| `/[locale]/admin/account` | Appearance — Accent `emerald` | N/A | `<html class="theme-emerald">`; cookie | `e2e/admin-account.spec.ts` | `E2E-ADM-ACC-ACCENT-EMERALD-017` | pending |
| `/[locale]/admin/account` | Appearance — Accent `amber` | N/A | `<html class="theme-amber">`; cookie | `e2e/admin-account.spec.ts` | `E2E-ADM-ACC-ACCENT-AMBER-018` | pending |
| `/[locale]/admin/account` | Language — `en` | N/A | Locale set; URL unchanged | `e2e/admin-account.spec.ts` | `E2E-ADM-ACC-LANG-EN-019` | pending |
| `/[locale]/admin/account` | Language — `es` | N/A | URL → `/es/...` | `e2e/admin-account.spec.ts` | `E2E-ADM-ACC-LANG-ES-020` | pending |
| `/[locale]/admin/account` | Language — `ptBR` | N/A | URL → `/pt-br/...` | `e2e/admin-account.spec.ts` | `E2E-ADM-ACC-LANG-PTBR-021` | pending |


---

<a id="31-ai-chat-panel"></a>
## §31 AI Chat Panel (floating)

Source: `components/cortex/chat-panel.tsx`. AI SDK v5 (`useChat`), SSE
transport via `/api/ai/chat`. Sheet on right; session id persisted in
`cortex_chat_session_id`; panel state in `cortex:chat-panel`.

| Page | Action | Mock API Scenario | Expected Result | E2E Test File | Test ID | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Global | Open chat panel | N/A | Right-side Sheet slides in; "0" messages | `e2e/chat.spec.ts` | `E2E-CHAT-OPEN-001` | pending |
| Global | Close chat panel | N/A | Sheet closes; state persisted | `e2e/chat.spec.ts` | `E2E-CHAT-CLOSE-002` | pending |
| Global | Send a message | `POST /api/ai/chat {messages}` (SSE) → stream | User bubble appears; AI token stream appends to assistant bubble | `e2e/chat.spec.ts` | `E2E-CHAT-SEND-003` | pending |
| Global | Empty input — Send disabled | N/A | Send button `disabled` | `e2e/chat.spec.ts` | `E2E-CHAT-EMPTY-004` | pending |
| Global | Cancel mid-stream | SSE abort | Stream stops; partial assistant message retained | `e2e/chat.spec.ts` | `E2E-CHAT-CANCEL-005` | pending |
| Global | Error response | mock SSE 500 | Error toast / inline error | `e2e/chat.spec.ts` | `E2E-CHAT-ERR-006` | pending |
| Global | Clear conversation | N/A | "New session" id minted; messages cleared | `e2e/chat.spec.ts` | `E2E-CHAT-CLEAR-007` | pending |
| Global | Session id persistence | localStorage `cortex_chat_session_id` | Reopen → previous id restored | `e2e/chat.spec.ts` | `E2E-CHAT-SESSION-PERSIST-008` | pending |
| Global | Panel width resize | drag handle | Width persisted to `cortex:chat-panel.width` | `e2e/chat.spec.ts` | `E2E-CHAT-WIDTH-009` | pending |
| Global | Panel pinned open across navigation | Navigate `/docker` → `/incus` | Sheet state rehydrates from localStorage | `e2e/chat.spec.ts` | `E2E-CHAT-PIN-010` | pending |
| Global | Session restore from disk | Pre-seed `cortex_chat_session_id` | Reopen shows prior session | `e2e/chat.spec.ts` | `E2E-CHAT-SESSION-RESTORE-011` | pending |
| Global | Network offline mid-stream | mock network drop | Inline error; partial message kept | `e2e/chat.spec.ts` | `E2E-CHAT-OFFLINE-012` | pending |

---

<a id="32-redirects-settings-error--loading-states"></a>
## §32 Redirects, Settings, Error / Loading States

| Page | Action | Mock API Scenario | Expected Result | E2E Test File | Test ID | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `/[locale]/` | Hit locale root | N/A — server redirect | Server redirect to `/{locale}/overview` | `e2e/redirects.spec.ts` | `E2E-REDIR-001` | pending |
| `/[locale]/dashboard` | Hit `/dashboard` | N/A — server redirect | Server redirect to `/{locale}/overview` | `e2e/redirects.spec.ts` | `E2E-REDIR-002` | pending |
| `/[locale]/services` | Hit `/services` | N/A — server redirect | Server redirect to `/{locale}/healthcheck` | `e2e/redirects.spec.ts` | `E2E-REDIR-003` | pending |
| `/[locale]/system` | Hit `/system` | N/A — server redirect | Server redirect to `/{locale}/storage` | `e2e/redirects.spec.ts` | `E2E-REDIR-004` | pending |
| `/[locale]/process` | Hit `/process` | N/A — server redirect | Server redirect to `/{locale}/processes` | `e2e/redirects.spec.ts` | `E2E-REDIR-005` | pending |
| `/[locale]/setup` | Hit `/setup` | N/A — server redirect | Server redirect to `/{locale}/login` | `e2e/redirects.spec.ts` | `E2E-REDIR-006` | pending |
| `/[locale]/settings` | Page load | N/A | Header + Appearance card placeholder "Theme settings coming soon." | `e2e/settings.spec.ts` | `E2E-SETTINGS-001` | pending |
| `/[locale]/loading.tsx` | Triggered by Suspense during route transition | N/A | Spinner/loading markup from `loading.tsx` | `e2e/loading.spec.ts` | `E2E-LOADING-001` | pending |
| `/[locale]/error.tsx` | Throw during render in mocked page | N/A | "Something went wrong" copy + retry button | `e2e/error.spec.ts` | `E2E-ERROR-001` | pending |
| `/[locale]/error.tsx` | Click retry after error | N/A | Reload attempts; if still failing, error persists | `e2e/error.spec.ts` | `E2E-ERROR-RETRY-002` | pending |
| `app/error.tsx` | Root error | N/A | Error boundary UI | `e2e/error.spec.ts` | `E2E-ERROR-ROOT-003` | pending |
| Not found | Hit unknown locale-prefixed path | N/A | Next.js 404 | `e2e/error.spec.ts` | `E2E-ERROR-404-004` | pending |

---

<a id="33-cross-cutting"></a>
## §33 Cross-cutting — Keyboard Shortcuts, Toasts, Empty / Loading / Error UI

| Surface | Action | Mock API Scenario | Expected Result | E2E Test File | Test ID | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Global | Keyboard shortcuts dialog opens via topbar `?` | N/A | Dialog lists Navigation / Actions / Tables groups | `e2e/cross-cutting.spec.ts` | `E2E-XCUT-001` | pending |
| Global | Keyboard shortcuts dialog closes via `Esc` | N/A | Dialog closes | `e2e/cross-cutting.spec.ts` | `E2E-XCUT-002` | pending |
| Global | Toast — success (sonner) | N/A (UI fires toast on success) | Green toast appears; auto-dismiss 4s | `e2e/cross-cutting.spec.ts` | `E2E-XCUT-003` | pending |
| Global | Toast — error (sonner) | N/A | Red toast appears; stays until dismissed | `e2e/cross-cutting.spec.ts` | `E2E-XCUT-004` | pending |
| Global | Toast — info (sonner) | N/A | Neutral toast; auto-dismiss | `e2e/cross-cutting.spec.ts` | `E2E-XCUT-005` | pending |
| Global | Empty state component | N/A | `<EmptyState icon title description>` rendered | `e2e/cross-cutting.spec.ts` | `E2E-XCUT-EMPTY-006` | pending |
| Global | Loading state component (Skeleton) | N/A | Skeleton block animates-pulse | `e2e/cross-cutting.spec.ts` | `E2E-XCUT-SKELETON-007` | pending |
| Global | DataTable pagination — first page | 30 rows, pageSize 25 | "1 of 2"; Prev disabled | `e2e/cross-cutting.spec.ts` | `E2E-XCUT-PAGE-FIRST-008` | pending |
| Global | DataTable pagination — last page | 30 rows, pageSize 25 | "2 of 2"; Next disabled | `e2e/cross-cutting.spec.ts` | `E2E-XCUT-PAGE-LAST-009` | pending |
| Global | DataTable — select row checkbox | mock selectable prop | Row marked selected; "1 selected" toolbar appears | `e2e/cross-cutting.spec.ts` | `E2E-XCUT-SELECT-010` | pending |
| Global | DataTable — select all on page | mock selectable + all selected | "All on page" toolbar | `e2e/cross-cutting.spec.ts` | `E2E-XCUT-SELECT-ALL-011` | pending |
| Global | DataTable — clear selection | click "Clear" | Selection cleared | `e2e/cross-cutting.spec.ts` | `E2E-XCUT-CLEAR-012` | pending |
| Global | DataTable — row right-click context menu | mock onRowContextMenu | Custom menu opens | `e2e/cross-cutting.spec.ts` | `E2E-XCUT-CONTEXTMENU-013` | pending |
| Global | ConfirmDialog — generic | N/A | AlertDialog opens w/ optional requireText input; confirm disabled until typed | `e2e/cross-cutting.spec.ts` | `E2E-XCUT-CONFIRM-014` | pending |
| Global | Form submit — pending state | mock with delay | Button text changes; disabled | `e2e/cross-cutting.spec.ts` | `E2E-XCUT-PENDING-015` | pending |
| Global | Page-level 401 redirect | `GET /api/...` → 401 | Toast + redirect to `/login` | `e2e/cross-cutting.spec.ts` | `E2E-XCUT-401-016` | pending |
| Global | Page-level 500 | mock 500 | Red toast with server error | `e2e/cross-cutting.spec.ts` | `E2E-XCUT-500-017` | pending |
| Global | Slow network indicator | mock 3s delay | Loading skeleton visible; no timeout | `e2e/cross-cutting.spec.ts` | `E2E-XCUT-SLOW-018` | pending |
| Global | Concurrent edits — two windows | mock 200 on both | Last write wins; no error | `e2e/cross-cutting.spec.ts` | `E2E-XCUT-RACE-019` | pending |
| Global | Long-running action timeout | mock 30s delay | No UI timeout (handled by sonner / backend) | `e2e/cross-cutting.spec.ts` | `E2E-XCUT-LONG-020` | pending |
| Global | Keyboard a11y — Tab order | N/A | Logical tab order across sidebar, topbar, main | `e2e/cross-cutting.spec.ts` | `E2E-XCUT-TAB-021` | pending |
| Global | Focus ring visible on all interactives | N/A | `focus-visible:ring-2` visible | `e2e/cross-cutting.spec.ts` | `E2E-XCUT-FOCUS-022` | pending |
| Global | Color contrast — text/background (light) | N/A | AA contrast across tokens | `e2e/cross-cutting.spec.ts` | `E2E-XCUT-CONTRAST-023` | pending |
| Global | Color contrast — text/background (dark) | N/A | AA contrast across tokens | `e2e/cross-cutting.spec.ts` | `E2E-XCUT-CONTRAST-DARK-024` | pending |


---

<a id="34-real-host-test-rht-exceptions"></a>
## §34 Real-Host-Test (RHT) Exceptions

These rows are flagged `RHT` because no mock can reproduce the behavior
faithfully. They are exercised by the **integration smoke** pipeline (real
host, real systemd unit, real Docker, real Incus) — not by Playwright. The
Playwright suite still covers the surface, just the parts that can be mocked.

| Page | Action | Why it needs a real host | E2E Test File | Test ID | Status |
| --- | --- | --- | --- | --- | --- |
| `/[locale]/terminal` | Full xterm render + ANSI escape | xterm uses canvas, requires real backend PTY | `e2e/terminal.spec.ts` | `E2E-TERM-RHT-009` | pending (RHT) |
| `/[locale]/incus/[name]` | Shell exec — full output stream | Incus shell uses real PTY/stdout, color codes | `e2e/incus.spec.ts` | `E2E-INCUS-SHELL-RHT-048` | pending (RHT) |
| `/[locale]/admin/env-browser` | Cleartext reveal via confirmation token | UI cannot mint `X-Cortex-Confirmation-Token`; backend gates it | `e2e/admin-env.spec.ts` | `E2E-ADM-ENV-REVEAL-RHT-014` | pending (RHT) |
| `/[locale]/` | Full SSR HTML — first paint with all widgets | Some react-grid-layout positions only resolve post-hydration; integration smoke runs this against a real `/api/system` snapshot | `e2e/cross-cutting.spec.ts` | `E2E-XCUT-SSR-RHT-025` | pending (RHT) |
| `/[locale]/incus` | Real incus CLI integration | `incus list`, `incus launch`, `incus exec` — privileged ops | `e2e/incus.spec.ts` | `E2E-INCUS-RHT-049` | pending (RHT) |
| `/[locale]/admin/systemd` | Real systemctl integration | `systemctl start/stop/restart` on actual units | `e2e/admin-systemd.spec.ts` | `E2E-ADM-SD-RHT-014` | pending (RHT) |
| `/[locale]/admin/docker` | Real docker CLI integration | `docker start/stop/restart/rm` against actual daemon | `e2e/admin-docker.spec.ts` | `E2E-ADM-DK-RHT-014` | pending (RHT) |
| `/[locale]/admin/incus` | Real incus delete with `--force` | Mutates real instances; needs CGroup/Incus daemon | `e2e/admin-incus.spec.ts` | `E2E-ADM-INC-RHT-019` | pending (RHT) |
| `/[locale]/systemd/[unit]` | Real systemctl status read | `systemctl is-active` semantics + journal reads | `e2e/systemd.spec.ts` | `E2E-SYSTEMD-DETAIL-RHT-023` | pending (RHT) |

---

<a id="35-domain-roll-up"></a>
## §35 Domain Roll-up

This roll-up is the M0 → M2 acceptance artifact. Each M2 PR that lands a
page or feature must update this section with `implemented` counts.

| Domain | Pending | Implemented | Verified | Notes |
| --- | --- | --- | --- | --- |
| Auth & Session (§1) | 15 | 0 | 0 | PAM mocked; RBAC ALLOW/DENY pairs required for every protected action |
| App Shell (§2) | 45 | 0 | 0 | 26 nav items, command palette, ⌘K + 8 g-sequences, mobile drawer |
| Overview (§3) | 19 | 0 | 0 | 16 widgets + edit/reset/add/remove; StatusHero variants |
| Apps (§4) | 16 | 0 | 0 | Filter chips, view modes, favorites, external open |
| Healthcheck (§5) | 17 | 0 | 0 | Period selector, sort, recheck, log stream |
| Docker (§6) | 37 | 0 | 0 | 3 tabs + detail page; client-only & API mutations |
| Incus (§7) | 47 | 0 | 0 | Wizard (5 steps), detail w/ shell, provision flow, AI analyze; 2 RHT (canonical list in §34) |
| Systemd (§8) | 22 | 0 | 0 | List + detail; admin-only actions; 1 RHT (canonical list in §34) |
| Storage (§9) | 8 | 0 | 0 | Mountpoint progress bars + drives table |
| Network (§10) | 5 | 0 | 0 | Metric cards + topology |
| Processes (§11) | 9 | 0 | 0 | Top-by-CPU sort + pagination |
| Terminal (§12) | 9 | 0 | 0 | 1 RHT (full xterm + ANSI) |
| Backups (§13) | 7 | 0 | 0 | List + size formatter |
| Scheduler (§14) | 7 | 0 | 0 | Active/next run |
| Alerts (§15) | 10 | 0 | 0 | Timeline + history + rules |
| Approvals (§16) | 12 | 0 | 0 | Approve / deny (deny requires reason) |
| Audit (§17) | 10 | 0 | 0 | Sheet detail + decision badges |
| Mail Guardian (§18) | 14 | 0 | 0 | 4 decisions × verdicts |
| Agents (§19) | 9 | 0 | 0 | 3-pane explorer |
| Admin · Services (§20) | 25 | 0 | 0 | CRUD + 5 health types |
| Admin · Badges (§21) | 17 | 0 | 0 | Color picker preview |
| Admin · Env Browser (§22) | 13 | 0 | 0 | Reveal gated; 1 RHT (confirmation-token) |
| Admin · Systemd (§23) | 13 | 0 | 0 | Stop w/ ConfirmDialog; 1 RHT (real systemctl) |
| Admin · Docker (§24) | 13 | 0 | 0 | Remove currently surfaces "not available"; 1 RHT (real docker CLI) |
| Admin · Alerts (§25) | 18 | 0 | 0 | 3 conditions, threshold toggle |
| Admin · Users (§26) | 10 | 0 | 0 | Read-only (PAM) |
| Admin · Projects (§27) | 21 | 0 | 0 | 2 messaging modes + repo URL |
| Admin · Incus (§28) | 18 | 0 | 0 | Delete requires `x-incus-delete-confirm` header; 1 RHT (real incus delete) |
| Admin · Audit Log (§29) | 14 | 0 | 0 | Export JSON + chain-verify badge |
| Admin · Account (§30) | 21 | 0 | 0 | 4 cards; theme + accent + locale + password |
| AI Chat Panel (§31) | 12 | 0 | 0 | SSE stream + session persistence |
| Redirects/Settings/Error/Loading (§32) | 12 | 0 | 0 | 6 redirects + error boundary + retry |
| Cross-cutting (§33) | 24 | 0 | 0 | Toasts, a11y, pagination, dialog, focus; 1 RHT (SSR) |
| **Total Playwright rows** | **558** | **0** | **0** | **= 549 main table rows + 9 RHT rows in §34. Integration smoke pipeline owns the RHT set (real host, real systemd, real Docker, real Incus).** |

