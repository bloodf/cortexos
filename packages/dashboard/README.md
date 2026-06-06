# @cortexos/dashboard

> SvelteKit 2 + Svelte 5 (runes) dashboard for CortexOS.
> The canonical web interface for managing CortexOS services, databases, and AI infrastructure.

---

## Quick start

```bash
# from the repo root
pnpm install

# dev server (Vite, port 5173)
pnpm --filter @cortexos/dashboard dev

# production build (adapter-node, output ./build)
pnpm --filter @cortexos/dashboard build

# production preview (port 3080, matches legacy Next.js dashboard)
pnpm --filter @cortexos/dashboard preview

# type-check
pnpm --filter @cortexos/dashboard typecheck

# unit + component tests (Vitest, jsdom)
pnpm --filter @cortexos/dashboard test

# E2E (Playwright; builds + previews automatically on port 3080)
pnpm --filter @cortexos/dashboard test:e2e
```

> **Port 3080** is the audit-locked production port (see
> `packages/dashboard/docs/CURRENT_ARCHITECTURE_AUDIT.md` §6.3).
> The dev server runs on 5173 by convention.

---

## What's in M1

- **SvelteKit 2.62 + Svelte 5.56** scaffold with runes everywhere
  (`$state`, `$derived`, `$props`, `$effect`).
- **TypeScript 6**, strict mode, no `any`, no `// @ts-ignore`.
- **Tailwind 4** with CSS-first config in `src/app.css`; the
  full shadcn token bridge (oklch, sidebar-*, chart-*, success,
  warning) and four brand presets (cortex, teal, emerald, amber)
  are preserved verbatim from the Next.js globals.
- **Design system** in `src/lib/components/ui/` —
  Button, Card, Input, Label, Select, Tabs, Dialog, Dropdown,
  Table, Toast, Skeleton, EmptyState, StatCard, PageHeader.
- **App shell** (`src/lib/components/shell/`) — collapsible
  sidebar, top bar with search/⌘K/theme/i18n, mobile drawer,
  skip-to-content link.
- **Command palette** (`src/lib/components/command-palette/`)
  with fuzzy search across pages and services.
- **i18n** (`src/lib/i18n/`) — JSON-based, `en` complete, `es` +
  `pt-br` stubs.
- **Auth route group** (`src/routes/(auth)/`) — `/login` form
  posts to a SvelteKit form action that returns 401 until the
  PAM wiring lands in M3.
- **Dashboard route** (`src/routes/(authed)/dashboard/`) —
  placeholder shell that downstream M2 widgets will land inside.
- **Admin gate** (`src/routes/(authed)/admin/`) — `+layout.server.ts`
  rejects non-admins with 403; admin tooling lands in M2.
- **CI shell** — `pnpm typecheck`, `pnpm lint`, `pnpm test`,
  `pnpm build`, `pnpm preview` all work; `pnpm lint` is wired
  but the full airbnb-extended ruleset is finalized in
  M1-WS8.
- **Tests** — 1 component test (Button, 8 cases) in
  Vitest, 1 E2E shell test (3 cases) in Playwright.

### What is NOT in M1 (deferred)

- Real authentication (PAM + sessions) → M1-WS4-backend-skeleton + M3.
- Polling / SSE / Socket.IO → M1-WS5-mock-api + M2.
- Real widgets on `/dashboard` → M2.
- Admin CRUD pages → M2.
- ESLint full ruleset → M1-WS8.
- 95 % coverage gate → enabled in M1-WS8.

---

## Layout

```
packages/dashboard/
├── package.json            # @cortexos/dashboard, pinned versions
├── svelte.config.js        # SvelteKit + adapter-node + runes
├── vite.config.ts          # tailwind + sveltekit + vitest
├── tsconfig.json           # extends .svelte-kit/tsconfig.json
├── eslint.config.js        # flat config: airbnb-extended + svelte + ts
├── playwright.config.ts
├── vitest.setup.ts         # jest-dom matchers
├── .prettierrc
├── e2e/
│   └── login.spec.ts       # shell test: /, /login form, validation
├── static/
│   └── favicon.svg
└── src/
    ├── app.css             # Tailwind 4 + oklch tokens + brand presets
    ├── app.d.ts            # App.Locals typed (user, session, requestId)
    ├── app.html            # no-flash inline script for theme/preset
    ├── hooks.server.ts     # requestId + framework headers (M1-WS5)
    ├── lib/
    │   ├── components/
    │   │   ├── ui/         # Button, Card, Input, Label, Select, Tabs,
    │   │   │               # Dialog, Dropdown, Table, Toast, Skeleton,
    │   │   │               # EmptyState, StatCard, PageHeader
    │   │   ├── shell/      # AppShell, Sidebar, TopBar
    │   │   ├── command-palette/CommandPalette.svelte
    │   │   ├── i18n/LocaleSwitcher.svelte
    │   │   ├── theme/ThemeSwitcher.svelte
    │   │   └── icons/      # 27 inline-SVG icon components
    │   ├── i18n/           # locale resolution + JSON messages
    │   ├── nav.ts          # single source of truth (4 groups)
    │   ├── theme-presets.ts
    │   └── utils/cn.ts
    └── routes/
        ├── +layout.server.ts        # theme + locale + user
        ├── +layout.svelte           # root layout (imports app.css)
        ├── +page.server.ts          # / → /dashboard or /login
        ├── +page.svelte
        ├── (auth)/                  # auth-only chrome
        │   ├── +layout.svelte
        │   ├── login/
        │   │   ├── +page.server.ts  # valibot schema + 401 stub
        │   │   └── +page.svelte
        │   └── logout/
        │       ├── +page.server.ts
        │       └── +page.svelte
        └── (authed)/                # gated by user; sub-layout
            ├── +layout.server.ts    # auth gate
            ├── +layout.svelte       # mounts AppShell
            ├── +error.svelte        # 403/404/500 in shell
            ├── dashboard/+page.svelte
            └── admin/
                ├── +layout.server.ts  # admin gate
                └── +page.svelte
```

---

## Where the design system lives

- Tokens → `src/app.css` (`@theme inline { ... }` block + the `:root`,
  `.dark`, `.theme-*` selectors below it).
- Primitives → `src/lib/components/ui/`. Each component is a Svelte 5
  file using `$props()` + snippets (`{#snippet header()}...{/snippet}`).
- App shell composition → `src/lib/components/shell/AppShell.svelte`.
  It owns: skip-to-content link, sidebar (desktop) / drawer (mobile),
  top bar, `<main id="main-content" tabindex="-1">`.
- Icons → `src/lib/icons/`. Inline-SVG components; no runtime
  dependency on `lucide-svelte` (per TECH_STACK pin).

## How the app shell works

`AppShell` renders four pieces of chrome in this order:

1. **Skip-to-content link** — a focusable `<a href="#main-content">`
   visible only on focus; the `<main>` carries `tabindex="-1"` so
   the focus target works.
2. **Desktop sidebar** — `Sidebar` with the four groups from
   `nav.ts`, admin items hidden for non-admins, active item marked
   via `aria-current="page"`.
3. **Mobile drawer** — opens via the TopBar hamburger; closes on
   backdrop tap, on the X button, or via `Esc`.
4. **TopBar + `<main>`** — `TopBar` carries the search hint,
   `CommandPalette` trigger (⌘K), `LocaleSwitcher`, `ThemeSwitcher`,
   and a user chip.

The auth gate runs in `src/routes/(authed)/+layout.server.ts`.
Anonymous users get a 303 to `/login?next=...`.

---

## Strict rules (apply to every PR into this package)

- **Svelte 5 idioms only.** No `let foo; $:` reactive statements.
  No React imports. No `on:click` — it's `onclick`.
- **No `any` in production code.** If you cannot type it, it isn't
  ready. Tests may relax this.
- **No `// @ts-ignore` without a comment explaining the next step.**
- **No new dependencies** beyond what is in `TECH_STACK.md`.
- **Token-based styling.** `bg-primary` is fine; `bg-[#7c3aed]` is
  not. New components consume semantic tokens, not raw oklch values.
- **Accessibility is non-negotiable.** Skip link, focus rings,
  `aria-current` on the active nav item, `aria-busy` on
  loading buttons, `role="alert"` on form errors, `tabindex={-1}`
  on the `<main>`.

---

## Environment variables

The SvelteKit dev server and adapter-node both read env at runtime.
Copy `.env.example` to `.env` and fill in values for local development.

Required for production:
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`

Optional:
- `CORTEX_AUTH_PAM_SERVICE` — PAM service name (default: `cortexos-dashboard`)
- `CORTEX_AUTH_FAKE_PAM` — set to `1` to bypass PAM (dev only, never in production)
- `CORTEX_DOCKER_BRIDGE_REAL` / `CORTEX_SYSTEMD_BRIDGE_REAL` — bridge mode toggles

---

## Pointers to upstream docs

- Architecture audit: `packages/dashboard/docs/CURRENT_ARCHITECTURE_AUDIT.md`
- Tech stack (locked): `packages/dashboard/docs/TECH_STACK.md`
- React→Svelte migration map: `packages/dashboard/docs/REACT_TO_SVELTE_MIGRATION_MAP.md`

---

*Last verified: 2026-06-03. See git log for change history.*
