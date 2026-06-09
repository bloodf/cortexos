# CortexOS Dashboard

A self-hosted infrastructure control-plane and observability dashboard for a single powerful Linux server running native systemd services, Docker containers, and Incus system containers.

Inspired by Linear, Vercel, and Grafana. Dense but calm, keyboard-first, dark-mode-first, fully responsive, accessible.

> **Status**: pre-1.0 — UI is feature-complete with realistic mock data. The backend adapter (`src/mocks/api.ts`) is a clean seam where you wire a real Linux host.

## Quick start

```bash
bun install
bun run dev          # http://localhost:5173
bun test             # vitest unit tests
bun run lint
bun run build
```

Demo credentials are shown on the login screen — both **admin** and **standard** roles are available so you can see RBAC in action.

## Features

- **Overview** — editable widget grid (`react-grid-layout`), persisted to `localStorage`
- **Apps · Healthcheck · Agents** — service catalog, probes, agent configs
- **Docker · Incus · Systemd** — full lifecycle controls (mock) with detail drawers (logs, metrics, env)
- **Storage · Network · Processes** — block devices, interfaces, htop-style table
- **Terminal** — real `xterm.js` with a mock PTY responding to `systemctl`, `docker ps`, `journalctl`, etc.
- **Mail Guardian · Alerts · Approvals · Audit** — sec-ops surfaces with incident timeline + hash-chained audit log
- **Admin** — Services, Users, Badges, Env Browser, Systemd, Docker, Incus, Alerts, Projects, Audit, Account
- **⌘K command palette** — fuzzy nav + executable actions (theme, accent, role switch, outage simulator)
- **Live drift simulator** — CPU/mem/network/sensors drift every 3 s; random service flips fire incidents
- **i18n** — `en`, `es`, `pt-BR` scaffolded (English-complete; others mirror English pending translation)
- **Theme** — light / dark / system × 4 accent presets (OKLCH)
- **Accessibility** — skip link, `?` shortcut overlay, semantic landmarks, focus-visible

## Stack

- **TanStack Start v1** (React 19, Vite 7, file-based routing, SSR-ready)
- **TanStack Query v5** for data fetching
- **shadcn/ui** + Radix primitives + Tailwind v4 (OKLCH design tokens in `src/styles.css`)
- **Recharts** for charts, **xterm.js** for the terminal, **react-grid-layout** for the dashboard
- **Vitest** + **Testing Library** for tests

## Architecture

```
src/
  app/           Shell — sidebar, top bar, command palette, mobile tab bar, nav config
  components/    Design-system primitives + shared widgets (DataTable, LogViewer, ...)
    skeletons/   Loading-state skeletons that match final layout (no layout shift)
    ui/          shadcn primitives (do not test directly)
  features/      One file per routed page; admin pages under features/admin/
    overview/    Page-local widgets
  hooks/         useAuth, useUI, useT, useFavorites, useHotkey, useKeyboardShortcuts, useLocalStorage
  i18n/          Translation dictionaries
  lib/           Pure utilities: format, fuzzy, status (100% unit-tested)
  mocks/         Seed data + mock API + drift simulator (the backend adapter seam)
  routes/        TanStack Router file-based routes — DO NOT edit routeTree.gen.ts
  styles.css     Tailwind v4 + design tokens
  test/          Vitest setup + render helpers
```

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for a deeper walk-through.

## Wiring a real backend

Every page reads from `src/mocks/api.ts`. To go live, replace each function in that file with a `fetch('/api/...')` call to your real backend (or a TanStack Start `createServerFn`). No page or component needs to change.

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## License

[MIT](./LICENSE)
