# Architecture

A guided tour of the CortexOS Dashboard codebase.

## Layered overview

```
┌──────────────────────────────────────────────────────────────────┐
│                          Browser (SPA)                           │
│                                                                  │
│  ┌──────────────┐   ┌──────────────────────────────────────────┐ │
│  │  AppShell    │   │           features/* (one per page)      │ │
│  │  Sidebar     │──▶│  Overview · Docker · Incus · Systemd     │ │
│  │  TopBar      │   │  Alerts · Approvals · Audit · Terminal   │ │
│  │  CmdPalette  │   │  admin/* (Users, Badges, Env, ...)       │ │
│  │  MobileTabs  │   └──────────────────────────────────────────┘ │
│  └──────────────┘            │                                    │
│         │                    │ useQuery                           │
│         ▼                    ▼                                    │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │   components/  — DataTable, LogViewer, DetailDrawer,         │ │
│  │                  MetricCard, Sparkline, StatusBadge, ...     │ │
│  │   skeletons/   — TableSkeleton, ChartSkeleton, ...           │ │
│  │   ui/          — shadcn primitives (Radix)                   │ │
│  └──────────────────────────────────────────────────────────────┘ │
│         │                                                         │
│         ▼                                                         │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │   hooks/   useAuth · useUI · useT · useFavorites · ...       │ │
│  │   lib/     format · fuzzy · status (pure)                    │ │
│  │   i18n/    en · es · ptBR                                    │ │
│  └──────────────────────────────────────────────────────────────┘ │
│         │                                                         │
│         ▼                                                         │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │   mocks/api.ts ◀─── replace with fetch('/api/...') for prod  │ │
│  │   mocks/seed.ts (static)  · mocks/drift.ts (live ticker)     │ │
│  └──────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

## Routing — TanStack Router

File-based. Filenames map to URLs via dots-to-slashes:

| File | URL |
|------|-----|
| `src/routes/index.tsx` | `/` |
| `src/routes/login.tsx` | `/login` |
| `src/routes/_authenticated.tsx` | layout (no URL) |
| `src/routes/_authenticated.overview.tsx` | `/overview` |
| `src/routes/_authenticated.admin.users.tsx` | `/admin/users` |

The `_authenticated` layout's `beforeLoad` redirects unauthenticated users to `/login`. The `/admin/*` routes additionally check `user.is_admin` and redirect to `/overview` if not allowed.

**Never edit `src/routeTree.gen.ts`** — it is regenerated on every dev/build by the TanStack Router Vite plugin.

## Data layer

Every page reads via TanStack Query, hitting `src/mocks/api.ts`:

```tsx
const { data: containers = [], isLoading } = useQuery({
  queryKey: ["docker", "containers"],
  queryFn: api.docker.containers,
});
```

- `mocks/seed.ts` — static seed data (typed by `mocks/types.ts`)
- `mocks/drift.ts` — `live.start(qc)` boots a 3-second ticker that mutates CPU / memory / processes / network / sensor readings and occasionally flips a service state, firing incidents into the alert history
- `mocks/api.ts` — the async API surface every page consumes

To wire a real backend, replace each function in `mocks/api.ts` with a `fetch('/api/...')` or `createServerFn` call. No page or component needs to change.

## State & theming

- `useUI()` — theme (`light` | `dark` | `system`), accent (4 OKLCH presets), locale, density
- `useAuth()` — mock localStorage-based session with role switching
- `useT()` — i18n dictionary lookup
- All styling uses semantic tokens from `src/styles.css`. Never use raw color classes.

## Tests

Vitest + Testing Library + jsdom.

- `src/lib/*.test.ts` — pure-function unit tests (100% target)
- `src/hooks/*.test.tsx` — hook tests with `renderHook`
- `src/components/*.test.tsx` — component tests with `renderWithProviders`
- `src/features/*.test.tsx` — smoke render tests per page

Helpers live in `src/test/utils.tsx` (provides `QueryClientProvider`).

## Accessibility commitments

- One `<main>` per page (in `AppShell`).
- Skip-to-content link.
- `?` opens a keyboard-shortcut overlay.
- Every icon-only button has `aria-label`.
- ESLint `jsx-a11y` plugin in the lint gate.
- Tap targets ≥ 44×44 for primary mobile actions.

## Build & deploy

- `bun run build` produces a static SSR-capable bundle.
- Targets Cloudflare Workers via `@lovable.dev/vite-tanstack-config` but builds run anywhere Vite runs.
