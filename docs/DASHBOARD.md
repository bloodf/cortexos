# Dashboard

The dashboard is a LAN/tailnet control console. It runs as the native systemd
unit `cortex-dashboard.service` (no Docker/container) on port 3080, built on the
host by `scripts/ops/cortex-dashboard-build.sh`. Login is **Linux PAM**: an OS
account authenticates against host PAM, and admin rights derive from membership
in the `cortexos-admin` / `sudo` groups. See
`packages/cortex-dashboard/CLAUDE.md` for the build, deploy, and admin lifecycle.

Root operations go through the dashboard helper Unix socket and must record
command metadata to Postgres and journald. The helper audit contract lives in
`manifests/rebuild/dashboard-helper-audit.sql` and
`manifests/rebuild/dashboard-helper-log-format.json`.

## Theme & design system

The UI is a shadcn-token-based design system. All colors are CSS variables in
oklch; components consume semantic tokens only and never hardcode hex.

### Tokens

`packages/cortex-dashboard/src/app/globals.css` defines the full shadcn token
set: semantic tokens (`--background`, `--foreground`, `--primary`,
`--destructive`, …), `--success` / `--warning`, the `--sidebar-*` family, and
`--chart-1`..`--chart-5`. Light is the `:root` default; `.dark` overrides.
recharts and gauge components bind to the `--chart-*` tokens so charts retint
automatically with mode and preset.

### Light / dark / presets

- **Mode** (light / dark / system) is handled by `next-themes` (wired in
  `src/app/layout.tsx`, hook in `src/hooks/use-theme.tsx`).
- **Brand preset** retints the base tokens. Default is `cortex` (violet);
  switchable presets are `teal`, `emerald`, `amber`. Each is a
  `.theme-<preset>` class applied to `<html>` (CSS blocks `.theme-cortex`,
  `.theme-teal`, `.theme-emerald`, `.theme-amber` in `globals.css`). Mode and
  preset compose (e.g. `.dark .theme-teal`).
- The active preset persists in the `cortex-preset` cookie. The server root
  layout reads that cookie at SSR and an inline no-flash script applies the
  class before paint, so there is no theme flash.
- Pure constants/types (`ThemeMode`, `ThemePreset`, `PRESETS`, `DEFAULT_PRESET`,
  `PRESET_COOKIE`, `presetClass`, `isPreset`) live in
  `src/lib/theme-presets.ts` — a non-`"use client"` module shared by the server
  layout and the client provider.
- Switchers: the sidebar footer (`src/components/layout/app-sidebar.tsx`) and
  the Settings page (`src/app/[locale]/settings/page.tsx`), both using the
  `ThemeSwitcher` component (`src/components/ui/theme-switcher.tsx`).

#### Adding a preset

1. Add the slug to `ThemePreset` and `PRESETS` in `src/lib/theme-presets.ts`.
2. Add a `.theme-<slug> { … }` block in `globals.css` overriding the brand
   tokens (and a `.dark .theme-<slug>` block if dark needs different values).
3. The switcher and cookie logic pick it up automatically from `PRESETS`.

### TechIcon registry

`src/components/tech-icon.tsx` resolves a service slug to a logo through a
three-step fallback:

1. **`developer-icons`** (npm) React component, if the slug is in `DEV_ICONS`.
2. **Vendored SVG** at `public/icons/<slug>.svg` (served at `/icons/<slug>.svg`),
   if the slug is in `VENDORED_SVGS`.
3. **Tinted monogram** (`src/components/icons/monogram.tsx`) colored by
   `BRAND_COLORS[slug]` as a stable fallback for brandless services.

`techIconSource(slug)` reports which tier resolves; `TECH_ICON_REGISTRY` is the
computed slug→source snapshot. `service-logo.tsx` delegates to `TechIcon`.

#### Adding a tech logo

1. Prefer a `developer-icons` component — import it and add the slug to
   `DEV_ICONS`.
2. Otherwise vendor a full-color brand SVG at `public/icons/<slug>.svg` and add
   the slug to `VENDORED_SVGS`.
3. Otherwise add a brand tint in `BRAND_COLORS[slug]` and the monogram fallback
   renders automatically.

### Reusable primitives

In `src/components/ui/`:

- `page-header.tsx` — standard page title/description/actions header.
- `stat-card.tsx` — metric/KPI card.
- `empty-state.tsx` — consistent empty/zero-data states.
- `data-table.tsx` — enhanced table with column visibility, filtering,
  pagination, and loading/empty states.
- recharts charts and gauges bound to the `--chart-*` tokens.

All 22 `[locale]` pages use these primitives (PageHeader + DataTable + tokens +
TechIcon). Data wiring is unchanged.

### Shell & navigation

- Navigation is defined once in `src/components/layout/nav-config.ts` (the
  source of truth), grouped into **Platform**, **Infrastructure**,
  **Security & Ops**, and **Admin** (collapsible). It is consumed by the desktop
  sidebar, mobile nav, and command palette.
- The shell adds a grouped collapsible sidebar, a top bar with breadcrumb and a
  `⌘K` command palette, and a mobile nav.
- To add a page to the nav, add a `NavItem` to the appropriate `NavGroup` in
  `nav-config.ts`.
