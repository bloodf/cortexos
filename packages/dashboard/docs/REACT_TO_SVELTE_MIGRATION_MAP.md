# React → Svelte Migration Map

> **M0-B Workstream B deliverable** — file-by-file map from the vendored `sys-pilot` (React 19 + Next.js 16) to a SvelteKit (Svelte 5 runes) target. Covers component boundary, state translation, design tokens, accessibility, and compatibility exceptions.
>
> **Author:** Ada Lovelace (TS React/Svelte Engineer) · **Worktree:** `.worktrees/m0-b-template-audit` on branch `feature/m0-b-template-audit`
>
> **Generated:** 2026-06-02 · **Status:** `pending` (M0-D picks target lib stack; M1 executes; M2 lands the last widgets)

---

## 0. Target stack (assumed — confirm with M0-D)

| Concern | Choice | Rationale |
|---|---|---|
| Framework | **SvelteKit 2 (latest)** on Node 22 | Same runtime as the current dashboard; same Vite build. |
| Svelte | **Svelte 5 (runes)** | Required for `state`, `derived`, `effect` primitives; matches React's "components are pure functions of state". |
| UI primitives | **`bits-ui` + `tailwind-variants`** | Closest API parity to the current shadcn-style primitives (`bits-ui` mirrors Radix). |
| Styling | **Tailwind CSS v4** (already in use) | Identical tokens port directly. |
| Server data | **SvelteKit `+page.server.ts` load + Remote Functions** | `load` for read paths; Remote Functions (`query`, `form`, `command`) for type-safe RPC. |
| Client cache | **`@tanstack/svelte-query`** | Same API as the current `@tanstack/react-query`; drop-in port. |
| Toasts | **`svelte-sonner`** | Direct port of `sonner`. |
| Command palette | **`bits-ui` Command** (replaces `cmdk`) | Same UX, Svelte-native. |
| Icons | **`lucide-svelte`** | Identical icon set. |
| Forms | **`sveltekit-superforms` + `zod`** | Reuses the existing zod schemas. |
| i18n | **SvelteKit-native** (`routing.ts`, `messages/{en,es,ptBR}.json`) | Already what the route structure expects. |
| Theme | **`mode-watcher`** | Same `next-themes` semantics. |
| Charts | **`layerchart`** | recharts Svelte port; Edsger sign-off needed (see §6). |
| Grid (dashboard) | **`svelte-grid` or `svelte-dnd-grid`** (TBD) | `react-grid-layout` has no first-class Svelte equivalent. **Edsger must approve.** |
| Terminal | **`@xterm/xterm` (vanilla)** | No change; the package is JS-only. |
| Animation | **Svelte `transition:` / `animate:` directives** | Replace `framer-motion`; native, no lib. |
| Drag & drop | **`svelte-dnd-action`** (for any future drag UI; not strictly needed for the template). | Drop-in. |
| Real-time | **`socket.io-client` (vanilla)** | No change. |
| Test (unit) | **`vitest`** (already in use) | Same. |
| Test (e2e) | **`@playwright/test`** (already in use) | Same. |
| Mock MSW (E2E) | **`msw` v2** (TBD-M1) | New dependency for the E2E mock layer. |

> **Cortexos already uses SvelteKit in other packages** — this is not a green-field adoption. SvelteKit conventions from those packages should be reused. The migration plan assumes we **add** a SvelteKit app to `packages/dashboard/` (replacing Next.js) OR create `packages/dashboard-svelte/` alongside. M0-D decides.

---

## 1. Translation primitives

### 1.1 React Server Component → SvelteKit

| React (Next 16) | SvelteKit (Svelte 5) | Notes |
|---|---|---|
| `page.tsx` (server) | `+page.server.ts` (`load` fn returning data) + `+page.svelte` (renders it via `let { data } = $props()`) | Default; data fetching happens in `load`. |
| `page.tsx` (client, `"use client"`) | `+page.svelte` (no `+page.server.ts`) | Pure client component, no server data. |
| `layout.tsx` | `+layout.server.ts` + `+layout.svelte` | Root layout owns the shell. |
| `api/*/route.ts` | `+server.ts` (SvelteKit endpoints) **OR** Remote Functions (`query`/`form`/`command`) | Prefer Remote Functions for typed RPC. |
| `requireAuth` / `requireAdmin` server guards | `hooks.server.ts` middleware OR Remote Function guards | Centralize. |
| Middleware-like | `hooks.server.ts` | `handle` function. |
| `next/headers` (`cookies`, `headers`) | `event.cookies`, `event.request.headers` (in `load` / `+server.ts`) | Same shape. |
| `next/navigation` `useRouter` | `$app/navigation` (goto, invalidate, invalidateAll) | Same purpose. |
| `next/navigation` `usePathname` | `$app/stores` (Svelte 4) **or** `$app/state` (Svelte 5: `page.url.pathname`) | Use `$app/state` in Svelte 5. |
| `next-intl` | SvelteKit `routing.ts` + `messages/` | Built-in. |
| `metadata` export | `<svelte:head>` or `+page.svelte` `<svelte:head>` block | Per-page; SvelteKit has no central metadata API. |
| `generateMetadata` (async) | SvelteKit `+page.server.ts` `load` returns `seo?: { title, description }`, head block consumes | Manual. |
| `dynamic = "force-dynamic"` | SSR pages (default) | Default; SvelteKit SSR is opt-out not opt-in. |

### 1.2 React Client patterns → Svelte 5 runes

| React | Svelte 5 | Notes |
|---|---|---|
| `useState<T>(x)` | `let count = $state(x)` | Same reactive primitive. |
| `useEffect(() => {...}, [deps])` | `$effect(() => {...})` | Auto-tracks deps. |
| `useMemo(() => f(x), [x])` | `const y = $derived(f(x))` | Pure derivation. |
| `useRef<T>(null)` | `let ref = $state<T \| null>(null)` **or** a plain `let ref` for DOM | For DOM refs, just use `let div: HTMLDivElement;` and `bind:this={div}`. |
| `useCallback(fn, deps)` | `$effect` (for side-effects) + plain functions (for handlers) | Functions don't need memoization in Svelte. |
| `createContext<T>(null)` + `useContext` | `setContext(key, value)` / `getContext<typeof key>(key)` in `+layout.svelte` | Or a class-based store. |
| `useReducer` | `$state` + a plain reducer function, **or** a `class Store { count = $state(0); inc() {...} }` | Both idiomatic. |
| `useQuery` (`@tanstack/react-query`) | `createQuery` (`@tanstack/svelte-query`) — same key, same fn | Drop-in. |
| `useMutation` | `createMutation` | Drop-in. |
| `useQueryClient` | `getQueryClient()` from a Svelte context | Provided via `QueryClientProvider`-equivalent. |
| `qc.setQueryData(key, updater)` | `queryClient.setQueryData(key, updater)` | Same API. |
| React Hook Form | `sveltekit-superforms` (adapter over zod) | Schema-validated, type-safe. |
| `FormEvent` handlers | `onsubmit={(e) => e.preventDefault()}` | Direct. |
| `onChange={(e) => ...}` | `oninput={(e) => ...}` (or `onchange` if you want change semantics) | Mind the difference: `oninput` fires on every keystroke. |
| `useTheme` (next-themes) | `mode-watcher`'s `setMode` / `mode` | Same UX. |
| `sonner` toasts | `toast` from `svelte-sonner` | Same. |
| `framer-motion` `<motion.div>` | Svelte `transition:fade`, `transition:slide`, `in:`, `out:` | Native, no lib. |
| `classnames` / `clsx` | `clsx` (works as-is) **or** template literals | Same. |
| `tailwind-merge` | `tailwind-merge` (works as-is) | Same. |
| `cmdk` (`<Command>` etc.) | `bits-ui` `<Command>` | Same UX. |
| `react-grid-layout` | `svelte-grid` (TBD; needs Edsger sign-off) | Or hand-roll. |
| `recharts` | `layerchart` (TBD; Edsger sign-off) | Svelte port. |
| `@xterm/xterm` | same | Vanilla. |
| `socket.io-client` | same | Vanilla. |

### 1.3 Tailwind tokens → Tailwind tokens (no change)

The current `tailwindcss` v4 config uses CSS vars (`--primary`, `--success`, `--warning`, `--destructive`, `--muted-foreground`, `--chart-1`..`--chart-3`, `--popover`, `--border`, `--sidebar`, `--sidebar-accent`, `--sidebar-border`, `--sidebar-foreground`, `--sidebar-accent-foreground`). Tailwind v4 reads these from the cascade. **No translation work needed** — copy the CSS into the new `app.css`.

Component-level class names that use shadcn-style composition (`cn(...)`, `<Button size="sm" variant="ghost">`) port verbatim to `bits-ui` + `tailwind-variants`.

### 1.4 Accessibility translation

The template's accessibility story is *good* (skip-to-main link, keyboard shortcuts, focus rings via `focus-visible:ring-2 focus-visible:ring-ring`, ARIA labels on icon-only buttons, `role="img"` on `TechIcon`, `aria-label` on `LogViewer` etc.). Port:

| React/SVG | Svelte 5 | Notes |
|---|---|---|
| `<a aria-label="Menu" onClick={fn}>` | `<button aria-label="Menu" onclick={fn}>` (or `<a>` for nav) | Icon-only → use `aria-label`, not `title`. |
| `tabIndex={-1}` on `<main>` | `tabindex={-1}` | Identical. |
| `role="alert"` on error text | `role="alert"` | Identical. |
| `aria-current="page"` on active nav link | `aria-current="page"` (Svelte attribute syntax) | Identical. |
| `aria-busy` on loading regions | `aria-busy` | Identical. |
| Keyboard shortcuts hook | `$effect` listening to `window` `keydown` (same code) | Almost 1:1. |
| Focus trap in `<Dialog>` | `bits-ui` `<Dialog>` handles it | Don't roll your own. |
| Skip link | Same `<a href="#main-content">` + `:focus-visible:not-sr-only` | Identical. |
| Color contrast (status colors) | Unchanged — CSS vars define both light and dark | Audit with axe (already in CI per repo). |
| `motion-reduce:animate-none` | Svelte: respect `prefers-reduced-motion` via a media query store; gate transitions | Svelte's `prefers-reduced-motion` store (svelte/motion has helpers). |

**M0-E / M1 actions:**
- Run `axe-core` on every migrated page; no regressions.
- Verify every interactive element has either an accessible name (`aria-label` or visible text) or a `sr-only` text.
- Verify focus order on `<DetailDrawer>` (Sheet): focus trap, restore focus on close.
- Verify command palette items have proper `aria-selected` / `aria-activedescendant`.
- Verify data table row actions are reachable by Tab (button focus) and triggerable by Enter/Space (native).
- Verify form errors are announced (already `role="alert"`; add `aria-invalid` + `aria-describedby` on inputs).
- Verify `useKeyboardShortcuts` ignores events when focus is in an `input`/`textarea` (already does via `inField` check; port the same logic).

---

## 2. File-by-file migration map

> Conventions:
> - **`type`**: `server` = SvelteKit `+page.server.ts` (data load on the server); `client` = `+page.svelte` only; `layout` = `+layout.svelte`; `component` = a `.svelte` file under `src/lib/components/...`; `util` = a `.ts` file; `api` = `+server.ts` endpoint.
> - **`boundary`**: `server-only` (must not run in browser) or `universal` (runs in both) or `client-only`.
> - **State pattern**: `runes` (uses `$state`/`$derived`), `props` (uses `$props()`), `context` (uses `setContext`/`getContext`), `remote-fn` (calls a `query()`/`command()` from `$lib/server/...`).
> - **`E2E`**: `TBD-M0C` (E2E matrix workstream decides the test ID for the new SvelteKit page).
> - **`Unit`**: suggested vitest file path. Component tests use `@testing-library/svelte` (Svelte 5 compatible via `@testing-library/jest-dom`).

### 2.1 Application shell & root

| Source file | Type | Target path | State pattern | Boundary | E2E | Unit | Notes |
|---|---|---|---|---|---|---|---|
| `src/app/[locale]/layout.tsx` | server+layout | `src/routes/(app)/+layout.server.ts` + `src/routes/(app)/+layout.svelte` | `load` for `user` (server); `setContext('user', ...)` in `+layout.svelte` | server-only (load) + universal (layout) | TBD-M0C | `unit: routes/(app)/layout` | Hosts `AppShell`, `CommandPalette`, `FavoritesBar`, `QueryClientProvider`-equivalent. |
| `src/app/sys-pilot/AppShell.tsx` | client (RSC boundary is the parent) | `src/lib/components/shell/AppShell.svelte` | `props: { children: Snippet }` | universal | TBD-M0C | `unit: shell/AppShell` | Replace `useState<collapsed>` with `$state`. Replace `useKeyboardShortcuts` call with the Svelte equivalent. |
| `src/app/sys-pilot/Sidebar.tsx` | client | `src/lib/components/shell/Sidebar.svelte` | `$state<collapsed, mobileOpen, adminOpen>`; `$props` for `collapsed/mobileOpen`; `setContext`/`getContext` for `user` (passed by parent) | universal (in layout) | TBD-M0C | `unit: shell/Sidebar` | |
| `src/app/sys-pilot/TopBar.tsx` | client | `src/lib/components/shell/TopBar.svelte` | `$state<mounted>` for SSR safety | universal | TBD-M0C | `unit: shell/TopBar` | |
| `src/app/sys-pilot/MobileTabBar.tsx` | client | `src/lib/components/shell/MobileTabBar.svelte` | `$state<activePath>` derived from `$app/state` | universal | TBD-M0C | `unit: shell/MobileTabBar` | |
| `src/app/sys-pilot/CommandPalette.tsx` | client | `src/lib/components/shell/CommandPalette.svelte` | `bits-ui` `<Command>`; `let recent = $state<string[]>([])` from localStorage; `let q = $state("")` | client-only (uses `window`) | TBD-M0C | `unit: shell/CommandPalette` | |
| `src/app/sys-pilot/NavConfig.ts` | util | `src/lib/nav.ts` (or merge into `src/components/layout/nav-config.ts`) | static export | universal | n/a | n/a | Legacy. Consolidate with `src/components/layout/nav-config.ts` into one `src/lib/nav.ts`. |
| `src/components/command-palette.tsx` | client | (see `CommandPalette.svelte` above — this is the one actually mounted) | same as above | client-only | TBD-M0C | `unit: shell/CommandPalette` | **Note:** there are two `CommandPalette` files (in `app/sys-pilot/` and in `components/`). The runtime uses `components/command-palette.tsx`. Consolidate to one file in the Svelte port. |
| `src/components/favorites-bar.tsx` | client | `src/lib/components/shell/FavoritesBar.svelte` | `$state<favorites>`; `use-favorites` → `src/lib/stores/favorites.svelte.ts` | client-only | TBD-M0C | `unit: shell/FavoritesBar` | |

### 2.2 Components (`src/components/sys-pilot/` → `src/lib/components/`)

| Source file | Type | Target path | State pattern | Boundary | E2E | Unit | Notes |
|---|---|---|---|---|---|---|---|
| `PageHeader.tsx` | server | `src/lib/components/ui/PageHeader.svelte` | `props: { icon?, title, description?, actions? }` | universal | n/a | `unit: ui/PageHeader` | Pure presentational. |
| `EmptyState.tsx` | server | `src/lib/components/ui/EmptyState.svelte` | `props` | universal | n/a | `unit: ui/EmptyState` | Pure presentational. |
| `StatusBadge.tsx` | client | `src/lib/components/ui/StatusBadge.svelte` | `props: { status, responseTime?, compact? }` | universal | n/a | `unit: ui/StatusBadge` | |
| `StatusHero.tsx` | client | `src/lib/components/overview/StatusHero.svelte` | `createQuery(['services'], api.services, { refetchInterval: 3000 })` + same for `system` | client-only (uses QueryClient) | TBD-M0C | `unit: overview/StatusHero` | |
| `MetricCard.tsx` | server | `src/lib/components/ui/MetricCard.svelte` | `props` | universal | n/a | `unit: ui/MetricCard` | |
| `Sparkline.tsx` | server | `src/lib/components/ui/Sparkline.svelte` | `props: { data, width?, height?, color?, fill? }` | universal | n/a | `unit: ui/Sparkline` | Pure SVG. |
| `AreaTrend.tsx` | server | `src/lib/components/ui/AreaTrend.svelte` | `props: { data, series, height?, yDomain?, xKey? }` | client-only (layerchart uses DOM) | n/a | `unit: ui/AreaTrend` | **recharts → layerchart** (Edsger sign-off). |
| `GaugeRadial.tsx` | server | `src/lib/components/ui/GaugeRadial.svelte` | `props: { value, max?, size?, label?, sublabel?, thresholds?, className? }` | universal | n/a | `unit: ui/GaugeRadial` | |
| `NetworkTopology.tsx` | client | `src/lib/components/network/NetworkTopology.svelte` | `createQuery(['network'], api.network, { refetchInterval: 3000 })` | client-only | TBD-M0C | `unit: network/NetworkTopology` | Pure SVG + SMIL animation; port is straightforward. |
| `KeyValueList.tsx` | server | `src/lib/components/ui/KeyValueList.svelte` | `props` | universal | n/a | `unit: ui/KeyValueList` | |
| `CodeBlock.tsx` | server | `src/lib/components/ui/CodeBlock.svelte` | `props: { code, language?, className?, maxHeight? }` | universal | n/a | `unit: ui/CodeBlock` | |
| `CopyButton.tsx` | client | `src/lib/components/ui/CopyButton.svelte` | `$state<done>`; on click `navigator.clipboard.writeText(value)` | client-only (uses `navigator`) | n/a | `unit: ui/CopyButton` | |
| `ConfirmDialog.tsx` | client | `src/lib/components/ui/ConfirmDialog.svelte` | `bits-ui` `<AlertDialog>`; `$state<open, text>` | client-only | n/a | `unit: ui/ConfirmDialog` | |
| `DataTable.tsx` | client | `src/lib/components/ui/DataTable.svelte` | `$state<q, sortKey, sortDir, page, selected>`; `$derived<filtered, sorted, view, selectedRows>` | client-only (props.data drives) | n/a | `unit: ui/DataTable` | Heaviest port. ~200 LOC. **Use a snippet for `cell`, `toolbar`, `selectionToolbar` slots.** |
| `DetailDrawer.tsx` | client | `src/lib/components/ui/DetailDrawer.svelte` | `props: { open, onOpenChange, title, description, tabs, actions }`; `bits-ui` `<Sheet>` + `<Tabs>` | client-only | n/a | `unit: ui/DetailDrawer` | Mock helpers (`MockLogs`, `MockMetrics`, `MockEnv`) move to `src/lib/components/docker/`. |
| `LogViewer.tsx` | client | `src/lib/components/logs/LogViewer.svelte` | `$state<container>`; `bind:this={container}`; `$effect(() => { if (follow && lines) container.scrollTop = container.scrollHeight })` | client-only | n/a | `unit: logs/LogViewer` | |
| `LogStream.tsx` | client | `src/lib/components/logs/LogStream.svelte` | `$state<lines, paused>`; `$effect` for `setInterval`; `onDestroy` clears it | client-only | TBD-M0C | `unit: logs/LogStream` | Keep mock OR replace with SSE per M1 decision. |
| `IncidentTimeline.tsx` | server | `src/lib/components/alerts/IncidentTimeline.svelte` | `props: { items: AlertHistory[] }`; `$derived<sorted>` | universal | n/a | `unit: alerts/IncidentTimeline` | |
| `IncidentToaster.tsx` | client | `src/lib/components/alerts/IncidentToaster.svelte` | `createQuery(['alerts','history'], api.alerts.history, { refetchInterval: 4000 })`; `$effect` toasts on new IDs | client-only (uses sonner) | TBD-M0C | `unit: alerts/IncidentToaster` | |
| `KeyboardShortcuts.tsx` | server | `src/lib/components/shell/KeyboardShortcutsDialog.svelte` | `props: { open, onOpenChange }`; `bits-ui` `<Dialog>` | universal | n/a | `unit: shell/KeyboardShortcutsDialog` | |
| `TechIcon.tsx` | server | `src/lib/components/ui/TechIcon.svelte` | `props` | universal | n/a | `unit: ui/TechIcon` | Deterministic color mixing. |
| `admin/admin-dashboard.tsx` | client (used in server page) | `src/lib/components/admin/AdminDashboard.svelte` | `props: { services: Service[] }` | universal | n/a | `unit: admin/AdminDashboard` | |
| `auth/login-form.tsx` | client | `src/lib/components/auth/LoginForm.svelte` | `$state<username, password, error, loading>`; on submit `await api.login()` then `goto('/admin')` + `invalidateAll()` | client-only | TBD-M0C | `unit: auth/LoginForm` | Use `sveltekit-superforms` or hand-rolled fetch. |
| `agents/agent-file-viewer.tsx` | client (stub) | `src/lib/components/agents/AgentFileViewer.svelte` | TBD; if stub stays, `props: { agentId }` → placeholder | client-only | TBD-M0C | `unit: agents/AgentFileViewer` | Replace stub with real file viewer in M1. |
| `incus/provision-wizard.tsx` | client | `src/lib/components/incus/ProvisionWizard.svelte` | `$state<step, phase, form fields>`; `$derived<busy>`; `$effect` for defaults + status polling; `onDestroy` clears interval | client-only | TBD-M0C | `unit: incus/ProvisionWizard` | Heaviest port. ~570 LOC. Use `sveltekit-superforms` for the form steps. |
| `overview/widgets.tsx` | client | `src/lib/overview/widgets.svelte.ts` (the **registry** of widget specs) + `src/lib/components/overview/*.svelte` (the 17 widget components) | Each widget is a `.svelte` file; the registry is a TS module exporting `WIDGETS: WidgetSpec[]`, `WIDGET_MAP`, `DEFAULT_LAYOUT` | client-only | TBD-M0C | `unit: overview/widgets` | The module-level `historyBuffer` ring becomes a Svelte 5 `$state` class. |

### 2.3 Lib (`src/lib/sys-pilot/` + `src/lib/`)

| Source file | Type | Target path | Boundary | Notes |
|---|---|---|---|---|
| `src/lib/sys-pilot/types.ts` | util | `src/lib/types.ts` | universal | Pure types; 1:1 port. |
| `src/lib/sys-pilot/status.ts` | util | `src/lib/ui/status.ts` | universal | Pure functions. |
| `src/lib/sys-pilot/format.ts` | util | `src/lib/format.ts` | universal | Pure functions. |
| `src/lib/types.ts` | util | `src/lib/types.ts` | universal | Re-exports the above; merge into one file. |
| `src/lib/api.ts` | util (HTTP client) | `src/lib/api.ts` — wrap each method as a **`query()` Remote Function** (SvelteKit 2.x) | universal (client) + server (handlers) | Each `api.foo()` becomes a typed `query(fn)` in `$lib/server/queries/foo.ts` called via `getQueryClient().fetchQuery({queryKey, queryFn})`. This gives type-safe RPC + caching + dedup. |
| `src/hooks/useAuth.tsx` | util | `src/lib/stores/auth.svelte.ts` (a `$state` class) + a `+layout.server.ts` `load` returning the real `user` from the session cookie | client + server | **Remove the local username-pattern mock.** Always read from server. |
| `src/hooks/useKeyboardShortcuts.tsx` | util | `src/lib/hooks/useKeyboardShortcuts.svelte.ts` — a function that takes `opts: { onHelp, onToggleSidebar, onPalette }` and returns nothing; callers use it inside an `$effect` | client-only | Port 1:1. |
| `src/hooks/use-favorites.ts` | util | `src/lib/stores/favorites.svelte.ts` — `$state` + `localStorage` sync via `$effect` | client-only | |
| `src/hooks/dashboard-data-context.tsx` | util | `src/lib/stores/dashboard-data.svelte.ts` — `setContext('dashboardData', data)` in root layout, `getContext` in widgets | client-only | |
| `src/hooks/use-dashboard-data.ts` | util | merge into the above | client-only | |
| `src/hooks/use-local-storage.ts` | util | `src/lib/hooks/useLocalStorage.svelte.ts` | client-only | |
| `src/hooks/use-mounted.ts` | util | Svelte 5 equivalent: `let mounted = $state(false); $effect(() => { mounted = true; return () => mounted = false; });` **OR** `import { onMount } from 'svelte'; let mounted = $state(false); onMount(() => mounted = true);` | client-only | |
| `src/hooks/use-socket.ts` | util | `src/lib/hooks/useSocket.svelte.ts` | client-only | |
| `src/hooks/use-theme.tsx` | util | `src/lib/hooks/useTheme.svelte.ts` (wraps `mode-watcher`) | client-only | |
| `src/hooks/__tests__/*` | tests | re-write in Svelte Testing Library | — | |
| `src/components/command-palette.tsx` (the active one) | client | merge into `CommandPalette.svelte` | client-only | |
| `src/components/favorites-bar.tsx` | client | `src/lib/components/shell/FavoritesBar.svelte` | client-only | |
| `src/components/layout/nav-config.ts` | util | `src/lib/nav.ts` | universal | Consolidate. |
| `src/components/layout/index.ts` | util | n/a (single file `src/lib/nav.ts`) | universal | Delete. |
| `src/components/layout/types.ts` | util | `src/lib/nav.ts` | universal | Merge. |
| `src/components/layout/app-shell.tsx` (unused) | client | delete | n/a | Unused. |
| `src/components/layout/app-sidebar.tsx` (unused) | client | delete | n/a | Unused. |
| `src/components/layout/top-bar.tsx` (unused) | client | delete | n/a | Unused. |

### 2.4 Routes — `src/app/[locale]/<page>.tsx` → `src/routes/<path>/+page.svelte` (+ optional `+page.server.ts`)

| Source route | Target SvelteKit path | Loader / server | State | E2E | Unit | Notes |
|---|---|---|---|---|---|---|
| `/[locale]/login` | `src/routes/(auth)/login/+page.svelte` (no loader) | n/a | `LoginForm` runes | TBD-M0C | `unit: routes/login` | |
| `/[locale]/setup` | delete (always redirects to `/login`) | n/a | n/a | n/a | n/a | |
| `/[locale]/page.tsx` (root redirect) | `src/routes/(app)/+page.ts` exports `redirect(307, '/overview')` | server | n/a | n/a | n/a | SvelteKit redirect. |
| `/[locale]/dashboard/page.tsx` | `src/routes/(app)/dashboard/+page.ts` redirect | server | n/a | n/a | n/a | |
| `/[locale]/process/page.tsx` | `src/routes/(app)/process/+page.ts` redirect | server | n/a | n/a | n/a | |
| `/[locale]/services/page.tsx` | `src/routes/(app)/services/+page.ts` redirect | server | n/a | n/a | n/a | |
| `/[locale]/system/page.tsx` | `src/routes/(app)/system/+page.ts` redirect | server | n/a | n/a | n/a | |
| `/[locale]/overview/page.tsx` | `src/routes/(app)/overview/+page.svelte` | client only | `$state<state, editing>`; RGL → `svelte-grid` (TBD) | TBD-M0C | `unit: routes/overview` | Layout persistence in localStorage. |
| `/[locale]/apps/page.tsx` | `src/routes/(app)/apps/+page.svelte` | client only | `$state<q, cat, statusFilter, view>`; `createQuery(['services'], api.services, { refetchInterval: 3000 })` | TBD-M0C | `unit: routes/apps` | |
| `/[locale]/healthcheck/page.tsx` | `src/routes/(app)/healthcheck/+page.svelte` | client only | `createQuery(['services'], …, 3000)` + `createQuery(['alerts','history'], …, 3000)` | TBD-M0C | `unit: routes/healthcheck` | |
| `/[locale]/agents/page.tsx` | `src/routes/(app)/agents/+page.svelte` | client only | `createQuery(['agents'], api.agents)` | TBD-M0C | `unit: routes/agents` | |
| `/[locale]/agents/[slug]/page.tsx` | `src/routes/(app)/agents/[slug]/+page.server.ts` (load `scanAgents()`) + `+page.svelte` | server | `data` from loader | TBD-M0C | `unit: routes/agents/[slug]` | |
| `/[locale]/docker/page.tsx` | `src/routes/(app)/docker/+page.svelte` | client only | `createQuery(['docker','containers'], …)` + `['docker','images']` + `['docker','volumes']` | TBD-M0C | `unit: routes/docker` | Replace `MockLogs/Metrics/Env` per M1. |
| `/[locale]/docker/[id]/page.tsx` | `src/routes/(app)/docker/[id]/+page.svelte` | client only | `createQuery(['docker','containers'])`; actions call `command('dockerAction', {action, name})` Remote Function | TBD-M0C | `unit: routes/docker/[id]` | |
| `/[locale]/incus/page.tsx` | `src/routes/(app)/incus/+page.svelte` | client only | `createQuery(['incus'], api.incus.instances)` | TBD-M0C | `unit: routes/incus` | Delete the local `ProvisionWizard`; link to `/incus/provision`. |
| `/[locale]/incus/[name]/page.tsx` | `src/routes/(app)/incus/[name]/+page.svelte` | client only | `createQuery(['incus', name], fetchDetail)` + `['incus', name, 'live'], fetchLiveInfo, {refetchInterval: 5000}` | TBD-M0C | `unit: routes/incus/[name]` | Actions call Remote Functions for `incusAction`, `incusShell`. |
| `/[locale]/incus/provision/page.tsx` | `src/routes/(app)/incus/provision/+page.svelte` | client only | `<ProvisionWizard />` runes | TBD-M0C | `unit: routes/incus/provision` | Uses Remote Functions. |
| `/[locale]/systemd/page.tsx` | `src/routes/(app)/systemd/+page.svelte` | client only | `createQuery(['systemd'], api.systemd)`; **use real `command('systemdAction')` for Start/Stop/Restart** (current page is local-state only) | TBD-M0C | `unit: routes/systemd` | M1 fix. |
| `/[locale]/systemd/[unit]/page.tsx` | `src/routes/(app)/systemd/[unit]/+page.svelte` | client only | `createQuery(['systemd'])`; actions via Remote Function | TBD-M0C | `unit: routes/systemd/[unit]` | |
| `/[locale]/storage/page.tsx` | `src/routes/(app)/storage/+page.svelte` | client only | `createQuery(['system'], api.system, {refetchInterval: 5000})` | TBD-M0C | `unit: routes/storage` | |
| `/[locale]/network/page.tsx` | `src/routes/(app)/network/+page.svelte` | client only | `createQuery(['network'], api.network, {refetchInterval: 3000})` | TBD-M0C | `unit: routes/network` | |
| `/[locale]/processes/page.tsx` | `src/routes/(app)/processes/+page.svelte` | client only | `createQuery(['processes'], api.processes, {refetchInterval: 3000})` | TBD-M0C | `unit: routes/processes` | |
| `/[locale]/terminal/page.tsx` | `src/routes/(app)/terminal/+page.svelte` | client only | `$effect` for xterm.js setup; `EventSource` to `?sessionId=…` | TBD-M0C | `unit: routes/terminal` | xterm.js is vanilla; port is straightforward. |
| `/[locale]/backups/page.tsx` | `src/routes/(app)/backups/+page.svelte` | client only | `createQuery(['backups'], api.backups, {refetchInterval: 30000})` | TBD-M0C | `unit: routes/backups` | **Requires `/api/backups` implementation (currently 404).** |
| `/[locale]/scheduler/page.tsx` | `src/routes/(app)/scheduler/+page.svelte` | client only | `createQuery(['scheduler'], api.scheduler, {refetchInterval: 10000})` | TBD-M0C | `unit: routes/scheduler` | |
| `/[locale]/mail-guardian/page.tsx` | `src/routes/(app)/mail-guardian/+page.svelte` | client only | `createQuery(['mail'], api.mailGuardian, {refetchInterval: 5000})` | TBD-M0C | `unit: routes/mail-guardian` | |
| `/[locale]/alerts/page.tsx` | `src/routes/(app)/alerts/+page.svelte` | client only | `createQuery(['alerts','rules'])` + `['alerts','history'], {refetchInterval: 3000}` | TBD-M0C | `unit: routes/alerts` | |
| `/[locale]/approvals/page.tsx` | `src/routes/(app)/approvals/+page.svelte` | client only | `createQuery(['approvals'], api.approvals)` | TBD-M0C | `unit: routes/approvals` | |
| `/[locale]/audit/page.tsx` | `src/routes/(app)/audit/+page.svelte` | client only | `createQuery(['audit'], api.audit, {refetchInterval: 10000})` | TBD-M0C | `unit: routes/audit` | Optionally also call `/api/audit/verify` and show real status. |
| `/[locale]/admin/page.tsx` | `src/routes/(app)/admin/+page.server.ts` (load `getAllServicesForAdmin()`) + `+page.svelte` | server | `data` from loader | TBD-M0C | `unit: routes/admin` | |
| `/[locale]/admin/services/page.tsx` | `src/routes/(app)/admin/services/+page.svelte` | client only | Remote Functions: `serviceCreate`, `serviceUpdate`, `serviceDelete` | TBD-M0C | `unit: routes/admin/services` | |
| `/[locale]/admin/badges/page.tsx` | `src/routes/(app)/admin/badges/+page.svelte` | client only | Remote Functions: `badgeCreate`, `badgeUpdate`, `badgeDelete` | TBD-M0C | `unit: routes/admin/badges` | |
| `/[locale]/admin/env-browser/page.tsx` | `src/routes/(app)/admin/env-browser/+page.svelte` | client only | `createQuery(['env-browser', path], fetchEnvFile)` | TBD-M0C | `unit: routes/admin/env-browser` | |
| `/[locale]/admin/systemd/page.tsx` | `src/routes/(app)/admin/systemd/+page.svelte` | client only | same as `/systemd` but admin | TBD-M0C | `unit: routes/admin/systemd` | |
| `/[locale]/admin/docker/page.tsx` | `src/routes/(app)/admin/docker/+page.svelte` | client only | `createQuery(['docker','containers'], …, 5000)` | TBD-M0C | `unit: routes/admin/docker` | |
| `/[locale]/admin/alerts/page.tsx` | `src/routes/(app)/admin/alerts/+page.svelte` | client only | `createQuery(['alerts','rules'], api.alerts.rules)` | TBD-M0C | `unit: routes/admin/alerts` | |
| `/[locale]/admin/users/page.tsx` | `src/routes/(app)/admin/users/+page.svelte` | client only | `createQuery(['users'], api.users)` | TBD-M0C | `unit: routes/admin/users` | |
| `/[locale]/admin/projects/page.tsx` | `src/routes/(app)/admin/projects/+page.svelte` | client only | `createQuery(['projects'], fetchProjects)` | TBD-M0C | `unit: routes/admin/projects` | |
| `/[locale]/admin/incus/page.tsx` | `src/routes/(app)/admin/incus/+page.svelte` | client only | `createQuery(['incus-instances'], fetchInstances, 5000)` | TBD-M0C | `unit: routes/admin/incus` | |
| `/[locale]/admin/audit/page.tsx` | `src/routes/(app)/admin/audit/+page.svelte` | client only | `createQuery(['audit'], api.audit, 10000)`; export button uses `Blob` + `URL.createObjectURL` | TBD-M0C | `unit: routes/admin/audit` | |
| `/[locale]/admin/account/page.tsx` | `src/routes/(app)/admin/account/+page.svelte` | client only | `$state<form fields>`; `command('changePassword', …)` Remote Function | TBD-M0C | `unit: routes/admin/account` | |
| `/[locale]/settings/page.tsx` | `src/routes/(app)/settings/+page.svelte` | client only | (placeholder; deferred) | TBD-M0C | `unit: routes/settings` | |

### 2.5 API surface (SvelteKit Remote Functions OR `+server.ts`)

| Source route | Target | Pattern | Notes |
|---|---|---|---|
| `/api/auth` (POST/DELETE) | `src/routes/api/auth/+server.ts` (POST/DELETE) **OR** `src/lib/server/commands/login.ts` (Remote `command`) | server | Prefer Remote `command` for login (typed) but keep the cookie-setting server-side. |
| `/api/services` (GET/POST/PATCH/DELETE) | `src/lib/server/queries/services.ts` (Remote `query`) + `src/lib/server/commands/serviceMutate.ts` (Remote `command`) | server | |
| `/api/system`, `/api/network`, `/api/processes` | `src/lib/server/queries/{system,network,processes}.ts` (Remote `query`) | server | |
| `/api/docker` (GET) | `src/lib/server/queries/docker.ts` (Remote `query`) | server | |
| `/api/docker/actions` (POST) | `src/lib/server/commands/dockerAction.ts` | server | Root-helper gated. |
| `/api/docker/logs` (GET) | `src/lib/server/queries/dockerLogs.ts` (TBD-M1 if we replace MockLogs) | server | |
| `/api/incus/**` | `src/lib/server/queries/incus*.ts` + `src/lib/server/commands/incus*.ts` | server | |
| `/api/systemd` (GET) | `src/lib/server/queries/systemd.ts` | server | |
| `/api/systemd/actions` (POST) | `src/lib/server/commands/systemdAction.ts` | server | |
| `/api/alerts` (GET/POST/PATCH/DELETE) | `src/lib/server/queries/alerts.ts` + `src/lib/server/commands/alertMutate.ts` | server | |
| `/api/approvals` (POST) | `src/lib/server/commands/approvalDecide.ts` **OR** `src/routes/api/approvals/+server.ts` | server | **Add `requireAuth` to the GET side too.** |
| `/api/audit` (GET) | `src/lib/server/queries/audit.ts` | server | |
| `/api/agents` (GET) | `src/lib/server/queries/agents.ts` | server | |
| `/api/mail-guardian/reviews` (GET/POST) | `src/lib/server/queries/mailReviews.ts` + `src/lib/server/commands/mailDecide.ts` | server | |
| `/api/badges` (GET/POST/PUT/DELETE) | `src/lib/server/queries/badges.ts` + `src/lib/server/commands/badgeMutate.ts` | server | |
| `/api/projects` (GET/POST/PUT/DELETE) | `src/lib/server/queries/projects.ts` + `src/lib/server/commands/projectMutate.ts` | server | |
| `/api/scheduler` (GET) | `src/lib/server/queries/scheduler.ts` | server | |
| `/api/backups` (GET) — **MISSING** | `src/lib/server/queries/backups.ts` — implement | server | List age-encrypted tarballs from NAS mount. |
| `/api/env-browser` (GET/POST) | `src/lib/server/queries/envBrowser.ts` + `src/lib/server/commands/envBrowserWrite.ts` (admin only, token-gated) | server | |
| `/api/terminal` (POST/GET-SSE) | `src/routes/api/terminal/+server.ts` (SSE requires `+server.ts`; Remote Functions don't support SSE) | server | Same as today. |
| `/api/auth/password` (POST) | `src/lib/server/commands/changePassword.ts` | server | |
| `/api/admin/services` (GET/POST/PATCH/DELETE) | `src/lib/server/queries/adminServices.ts` + `src/lib/server/commands/adminServiceMutate.ts` | server | |
| `/api/admin/users` (GET) | `src/lib/server/queries/adminUsers.ts` | server | |

**Guard pattern for Remote Functions:** All admin/mutating functions call `requireAuth` / `requireAdmin` (server-only) at the top; the type system enforces the return shape.

---

## 3. State management translation summary

| Pattern (React) | Pattern (Svelte 5) |
|---|---|
| `useState` (local) | `$state` (component-scoped) |
| `useState` (shared, single-page) | `setContext` / `getContext` in a `+layout.svelte` |
| `useState` (global, multi-page) | `.svelte.ts` module with a class exporting `$state` fields, or a writable store |
| `useReducer` | `$state` + a reducer function, OR a Svelte 5 class with methods |
| `useEffect` (mount/unmount) | `$effect` (mount) + cleanup return (unmount) |
| `useEffect` (window listeners) | `$effect` adding the listener, returning the cleanup |
| `useMemo` | `$derived` |
| `useRef` (DOM) | `let el: HTMLDivElement;` + `bind:this={el}` |
| `useRef` (mutable value, no re-render) | `let ref = $state(...)` (but typically you don't need this — most "refs" become `$state` so they react) |
| `useQuery` (React Query) | `createQuery` (`@tanstack/svelte-query`) |
| `useMutation` | `createMutation` |
| `useQueryClient` | `getQueryClient()` from a context provider in the root `+layout.svelte` |
| React Context | `setContext(key, value)` / `getContext<T>(key)` (in `+layout.svelte`); or module-level exports |
| next-themes (`useTheme`) | `mode-watcher`'s `mode` / `setMode` |
| `framer-motion` | Svelte built-in `transition:`, `in:`, `out:` directives |
| `localStorage` direct | `src/lib/hooks/useLocalStorage.svelte.ts` (rune + `$effect` for sync) |

### 3.1 Data flow per page (representative)

**`/overview` (current)**
1. `useQuery(['services'], api.services, 3000)` — TanStack cache.
2. `useQuery(['system'], api.system)` — TanStack cache.
3. `useQuery(['network'], api.network, 3000)` — TanStack cache.
4. `useQuery(['processes'], api.processes, 3000)` — TanStack cache.
5. `useQuery(['docker','containers'], api.docker.containers)` — TanStack cache.
6. `useQuery(['incus'], api.incus.instances)` — TanStack cache.
7. `useQuery(['alerts','history'], api.alerts.history)` — TanStack cache.
8. `useHistory()` — shared ring buffer via `useQuery(['history'], …, 5000)`.

**`/overview` (SvelteKit)**
1. Same `createQuery` calls.
2. `useHistory` becomes a class `DashboardHistory` exported from `src/lib/overview/history.svelte.ts` with `$state<points>` updated by a single shared `setInterval` in `+layout.svelte`.
3. Server load (`+page.server.ts`) does NOT pre-fetch; the page is client-heavy with periodic refresh. (Or, alternatively, use SvelteKit's `+page.server.ts` `load` for first render, then `createQuery` for incremental updates.)

**`/admin` (current)** — server-side `getAllServicesForAdmin()` rendered into `<AdminDashboard services={...} />`.

**`/admin` (SvelteKit)** — `+page.server.ts` `load` returns `{ services }`; `+page.svelte` reads `let { data } = $props()`.

---

## 4. Design token translation

**No translation work needed.** The current `tailwindcss` v4 setup uses CSS custom properties for all colors, radii, shadows, and chart palettes. Copy the `:root` / `.dark` definitions and the `@theme inline { ... }` block from the current `globals.css` into the new `app.css`. Component class names that use `bg-card`, `text-muted-foreground`, `border-border`, etc. will resolve identically.

**Token name** → **CSS var** (and Tailwind alias) mapping to preserve:

| Token | CSS var | Used by |
|---|---|---|
| Background | `--background` | `bg-background` |
| Foreground | `--foreground` | `text-foreground` |
| Card | `--card` / `--card-foreground` | `bg-card`, `text-card-foreground` |
| Popover | `--popover` / `--popover-foreground` | `bg-popover`, `text-popover-foreground` |
| Primary | `--primary` / `--primary-foreground` | `bg-primary`, `text-primary-foreground` |
| Secondary | `--secondary` / `--secondary-foreground` | (shadcn) |
| Muted | `--muted` / `--muted-foreground` | `text-muted-foreground`, `bg-muted` |
| Accent | `--accent` / `--accent-foreground` | `bg-accent` |
| Destructive | `--destructive` / `--destructive-foreground` | `bg-destructive` |
| Success (CortexOS extension) | `--success` | `text-[var(--success)]` (inline used) |
| Warning (CortexOS extension) | `--warning` | `text-[var(--warning)]` |
| Border | `--border` | `border-border` |
| Input | `--input` | `border-input` |
| Ring | `--ring` | `ring-ring` |
| Chart palette | `--chart-1`..`--chart-3` | widgets.tsx Sparklines |
| Sidebar | `--sidebar` / `--sidebar-foreground` / `--sidebar-accent` / `--sidebar-accent-foreground` / `--sidebar-border` | Sidebar component |
| Code block bg | `oklch(0.14 0.01 260)` | CodeBlock, LogViewer, docker/page wizard log |
| Code block fg | `oklch(0.92 0.01 260)` | ditto |
| LogViewer bg | `oklch(0.12 0.01 260)` | LogViewer |
| LogViewer fg | `oklch(0.88 0.01 260)` | LogViewer |

**Action:** in M1, audit the new `app.css` against the existing `globals.css` for any missing tokens; the existing list is the canonical source.

---

## 5. Accessibility translation

The current template is **above average** for accessibility. Port checklist:

| Concern | Current state | SvelteKit action |
|---|---|---|
| Skip link | `<a href="#main-content" class="sr-only focus:not-sr-only ...">` in `AppShell` | Same markup; render in `+layout.svelte` |
| `<main id="main-content" tabindex="-1">` | `AppShell` | Same |
| Icon-only buttons | `aria-label="Menu"`, `aria-label="Search"`, etc. | Same — add `aria-label` to every `<button>` whose only content is an icon |
| Form errors | `<p role="alert">` | Same; add `aria-invalid="true"` + `aria-describedby="error-id"` on inputs that have an error message |
| Color-only status | `bg-[var(--success)]/10 text-[var(--success)]` (StatusBadge) | StatusBadge also has a colored dot; do not rely on color alone — add `aria-label` if the dot is the only signal |
| `<Dialog>` focus trap | via shadcn `AlertDialog`/`Dialog` primitives | via `bits-ui` `<Dialog>` (built-in) |
| Sheet focus trap | via shadcn `Sheet` | via `bits-ui` `<Dialog>` (modal) or `bits-ui` `<Popover>` (non-modal) |
| Command palette | shadcn `CommandDialog` (focus-trapped, escape-closes, arrow-keys move) | `bits-ui` `<Command>` |
| Tabs | shadcn `Tabs` (arrow-key navigation built-in) | `bits-ui` `<Tabs>` (or native `<button role="tab">`) |
| Data table | `<table>` with `<thead>`, `<th>`, `<td>`; sort buttons have `aria-label="Sort by X"` | Same markup in `.svelte` |
| Toast | `sonner` sets `role="status"` and `aria-live="polite"` | `svelte-sonner` does the same |
| Keyboard shortcuts | `useKeyboardShortcuts` | `useKeyboardShortcuts.svelte.ts` — port 1:1 |
| Skip logic | `inField = tag === "input" \|\| "textarea" \|\| contentEditable` | Same check in `$effect` handler |
| Reduced motion | `motion-reduce:animate-none` on many elements | Wrap each animated element with `prefers-reduced-motion` media-query check OR set `transition` inside `prefers-reduced-motion: no-preference` |
| Color contrast | Sufficient for status pills (dark/light) | Audit with axe-core in CI |
| Labels | `<Label>` paired with `<Input>` | `bits-ui` `<Label>` (or native `<label for="…">`) |
| Disabled buttons | `disabled={!isAdmin}` | `disabled={!isAdmin}` — `bits-ui` components also pass through `aria-disabled` |

**M0-E (threat model) interaction:** RBAC enforcement on the **server** is what prevents privilege escalation; the client-side `disabled={!isAdmin}` is a UX hint, not a security boundary. M0-E should confirm the server-side auth chain is intact after the migration.

---

## 6. Compatibility exceptions requiring Edsger's approval

These are the only places I see real risk in the React → Svelte 5 port. None are blockers; each has a recommended default.

| # | Concern | Severity | Recommendation | Edsger sign-off? |
|---|---|---|---|---|
| 1 | **Dashboard grid library** — `react-grid-layout` has no first-class Svelte equivalent. Options: (a) `svelte-grid` (mature but small community), (b) `svelte-dnd-grid` (similar), (c) hand-rolled CSS grid + custom drag handles. The current `/overview` page uses RGL for drag-resize + persistent layout. | medium | **(a) `svelte-grid`** if it has the API we need; **(c) hand-roll** if it doesn't. Hand-roll is ~2–3 days for 17 widgets. | **YES** — choose library or hand-roll. |
| 2 | **Chart library** — `recharts` (used by `AreaTrend.tsx`) → `layerchart` is the closest Svelte port. `layerchart` API differs (uses Svelte components, not React JSX). | low | **`layerchart`** — direct port. | YES (low urgency) |
| 3 | **Drag & drop** (not currently used by the template, but `react-colorful` is in `package.json` and is used by `BadgeManager` (if it survives the sys-pilot refactor). `react-colorful` has no first-class Svelte port. | low | Drop `react-colorful`; use `<input type="color">` (already done in `admin/badges/page.tsx`). | NO (already mitigated) |
| 4 | **Animation library** — `framer-motion` is in `package.json` but only used in 1–2 places (search the codebase). | low | **Native Svelte transitions** (`transition:fade`, `transition:slide`). | NO (no lib swap needed) |
| 5 | **Form library** — `react-hook-form` is in `package.json` but the template doesn't actually use it (every form is hand-rolled `useState`). | low | **Drop `react-hook-form`**. Use `sveltekit-superforms` only for forms that need progressive enhancement (none currently). | NO (drop, not swap) |
| 6 | **Toasts** — `sonner` is in `package.json`. | low | **`svelte-sonner`** — direct port. | NO |
| 7 | **Command palette** — `cmdk` is in `package.json`. | low | **`bits-ui` `<Command>`** — same UX, Svelte-native. | NO |
| 8 | **Data fetching** — `@tanstack/react-query` v5 in `package.json`. | low | **`@tanstack/svelte-query`** — same API surface, drop-in port. | NO |
| 9 | **Theme** — `next-themes` in `package.json`. | low | **`mode-watcher`** — same `useTheme()` semantics. | NO |
| 10 | **Terminal** — `@xterm/xterm` and `@xterm/addon-fit`. | none | **Vanilla JS — works as-is.** | NO |
| 11 | **Real-time** — `socket.io-client`. | none | **Vanilla JS — works as-is.** | NO |
| 12 | **i18n** — `next-intl` in `package.json`. | low | **SvelteKit-native**: drop `next-intl`; use SvelteKit's `routing.ts` + `params.locale` + per-locale `messages/{en,es,ptBR}.json`. | NO |
| 13 | **Two `CommandPalette` files** (`app/sys-pilot/CommandPalette.tsx` and `components/command-palette.tsx`) | low | **Consolidate to one** `CommandPalette.svelte`. | NO |
| 14 | **Two `AppShell` files** (`app/sys-pilot/AppShell.tsx` and `components/layout/app-shell.tsx`) | low | **Consolidate to one** `AppShell.svelte`. | NO |
| 15 | **Two `TopBar` files** (`app/sys-pilot/TopBar.tsx` and `components/layout/top-bar.tsx`) — only the first is used at runtime. | low | **Delete the unused one** in `components/layout/`. | NO |
| 16 | **xterm + Svelte 5 SSR** — `@xterm/xterm` touches `window`/`document` at import time. | low | **Client-only mount** — initialize inside `$effect` so it never runs on the server. | NO (already done in the source) |
| 17 | **`useAuth` mock** — local username-pattern fallback | high | **Delete the local fallback in M1.** Always read from server. | YES (security) |
| 18 | **Server-side auth guards** — multiple admin endpoints rely on `requireAuth` only, not `requireAdmin`. | high | **Add `requireAdmin` consistently** in M1. | YES (security, M0-E) |
| 19 | **Privileged surfaces (terminal, env-browser, incus shell, incus delete, docker actions, systemd actions)** | high | **All stay server-side and are gated by `requireAdmin` + name regex.** No change to surface, just relocates the code. **Schneier must re-review after migration.** | YES (M0-E) |
| 20 | **Polling storm** — 18 distinct poller sites, many overlapping | medium | **In M2, consider an SSE broadcast channel** (e.g. `useWebSocket` for `/api/realtime`). For M1, keep the per-page pattern. | NO (M2 consideration) |

**Summary:** 5 items need explicit Edsger sign-off (1, 2, 17, 18, 19). Items 17–19 are security-sensitive; item 1 is a UI-lib decision; item 2 is a chart-lib decision.

---

## 7. Migration phases (proposed)

| Phase | Scope | Effort estimate | Depends on |
|---|---|---|---|
| **M0-D** | Pick Svelte UI lib, chart lib, grid lib; pick folder structure (`packages/dashboard-svelte/` or replace in-place) | small | — |
| **M1.1** | Set up SvelteKit app skeleton; port `app.css`; port `tailwind.config` (or v4 theme); port `next-intl` → SvelteKit i18n | 2 days | M0-D |
| **M1.2** | Port all `src/lib/sys-pilot/*` (types, status, format) | 0.5 day | M1.1 |
| **M1.3** | Port all presentational components (`PageHeader`, `EmptyState`, `MetricCard`, `Sparkline`, `GaugeRadial`, `KeyValueList`, `CodeBlock`, `CopyButton`, `StatusBadge`, `TechIcon`, `EmptyState`, `LogViewer`) | 3 days | M1.1 |
| **M1.4** | Port `DataTable` (heaviest) + `ConfirmDialog` + `DetailDrawer` | 2 days | M1.3 |
| **M1.5** | Port `IncidentTimeline`, `IncidentToaster`, `KeyboardShortcuts` dialog | 1 day | M1.3 |
| **M1.6** | Port `AppShell`, `Sidebar`, `TopBar`, `MobileTabBar`, `CommandPalette` | 2 days | M1.3, M1.4 |
| **M1.7** | Port routes that don't need server data: `/apps`, `/healthcheck`, `/network`, `/processes`, `/storage`, `/systemd`, `/systemd/[unit]`, `/backups`, `/scheduler`, `/mail-guardian`, `/alerts`, `/approvals`, `/audit`, `/login`, `/settings` | 4 days | M1.5, M1.6 |
| **M1.8** | Port routes with server data: `/admin`, `/agents`, `/agents/[slug]`, `/incus`, `/incus/[name]`, `/incus/provision`, `/overview` (RGL) | 5 days | M1.5, M1.6 |
| **M1.9** | Port admin CRUD routes (`/admin/services`, `/admin/badges`, `/admin/env-browser`, `/admin/systemd`, `/admin/docker`, `/admin/alerts`, `/admin/users`, `/admin/projects`, `/admin/incus`, `/admin/audit`, `/admin/account`) | 5 days | M1.7 |
| **M1.10** | Port `lib/api.ts` → Remote Functions | 1 day | M1.1 |
| **M1.11** | Port hooks: `useAuth`, `useKeyboardShortcuts`, `use-favorites`, `useLocalStorage`, `use-socket`, `use-theme`, `use-mounted`, `use-dashboard-data` | 2 days | M1.1 |
| **M1.12** | Port `lib/incus/instance-config` + the 5-step `ProvisionWizard` | 2 days | M1.4 |
| **M1.13** | Port terminal route (xterm.js) | 0.5 day | M1.3 |
| **M1.14** | Server-side: port all 54 `route.ts` endpoints to SvelteKit `+server.ts` **or** Remote Functions; implement the missing `/api/backups` | 5 days | M1.10 |
| **M1.15** | Server-side: consolidate auth helpers; re-add `requireAdmin` to currently-unguarded endpoints (`/api/approvals`) | 0.5 day | M1.14 |
| **M1.16** | Unit tests (vitest + @testing-library/svelte) for every component | 4 days | M1.1–M1.13 |
| **M1.17** | E2E tests (Playwright) — per-page | (M0-C owns) | M1.7–M1.9 |
| **M2** | Replace `MockLogs`/`MockMetrics`/`MockEnv` with real backend endpoints; replace `LogStream` with SSE; add real-time broadcast channel; consolidate polling | 3 weeks | M1 |

---

## 8. Open questions for the squad

1. **M0-D:** Where does the SvelteKit app live — `packages/dashboard/` (replace Next.js) or `packages/dashboard-svelte/` (alongside)?
2. **M0-D:** Confirm UI lib (`bits-ui` vs. `melt-ui`).
3. **M0-D:** Confirm chart lib (`layerchart` vs. `chart.js`).
4. **M0-D:** Confirm grid lib (`svelte-grid`, `svelte-dnd-grid`, or hand-roll).
5. **M0-E:** Confirm `requireAdmin` must be added to currently-unguarded endpoints in M1.
6. **M1:** Confirm `MockLogs` / `MockMetrics` / `MockEnv` should be replaced with real backend endpoints (preferred) or kept as "demo data" placeholders.
7. **M1:** Confirm `LogStream` should be replaced with real SSE feed.
8. **M1:** Confirm the dead `_SAMPLE_LOGS` constant and the local `ProvisionWizard` in `incus/page.tsx` can be deleted.
9. **M1:** Confirm `useAuth` local mock fallback can be deleted.
10. **M1:** Confirm `/api/backups` should be implemented (likely yes; required by the `/backups` page).
11. **M1:** Confirm `/admin/account` "Save profile" button can be removed (currently a toast-only stub).

---

*End of REACT_TO_SVELTE_MIGRATION_MAP.md — M0-B Workstream B.*
