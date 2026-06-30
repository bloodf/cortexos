# CortexOS Dashboard Color Palette Revamp — Design Spec

## Summary

Redesign the `packages/dashboard-next` color palette to a clean, dark, techy graphite aesthetic with readable text, a subtle white/gray accent, and a muted multi-color chart palette. Both light and dark modes are covered; the immediate visual target is the dark Overview dashboard shown in the reference screenshot.

## Goals

- Replace the current dark mode purple/blue tint (`#03001C`, `#301E67`, `#B6EADA`) with a neutral graphite scale.
- Improve text readability by increasing contrast between primary/secondary text and backgrounds.
- Give charts a coherent, desaturated multi-color palette that works on dark graphite.
- Keep the existing two-layer theme system (Astryx + Tailwind) but make the tokens consistent.
- Leave a clean foundation for a future light-mode polish pass.

## Non-goals

- No component structural changes (widgets, sidebar, charts stay the same).
- No new dependencies.
- No animation or motion changes.

## Direction

- **Vibe:** Clean graphite, Apple-style dark UI, low chroma.
- **Accent:** Subtle white/gray instead of a colored accent.
- **Charts:** Muted multi-color (graphite + soft cyan/amber/green/red/violet/blue/yellow/etc.).

## Architecture

The dashboard currently has two theme layers:

1. **Astryx design-system layer** — `src/lib/theme.ts` defines tokens; `astryx theme build` generates `src/lib/theme.css`.
2. **Tailwind/shadcn layer** — `src/styles.css` maps Astryx tokens to shadcn-compatible CSS variables such as `--background`, `--foreground`, `--primary`, `--chart-1`…`--chart-5`, `--success`, etc.

This revamp updates both layers so every component draws from the same graphite palette. The Tailwind layer is expanded from 5 chart colors to 12 (`--chart-1` … `--chart-12`) to support richer data visualizations.

## Token Model

### Neutral Graphite Scale

A hand-tuned 12-step gray family. The same scale is used in both modes; only the semantic mapping changes. `gray-50` … `gray-1000` are conceptual labels; the implementation writes the hex values directly into CSS custom properties (e.g. `--background: #17171A`).

| Token | Hex | Usage notes |
|-------|-----|-------------|
| `gray-50` | `#F7F7F8` | Light mode primary text / dark mode subtle surfaces |
| `gray-100` | `#ECECED` | Light mode headings / dark mode primary text |
| `gray-200` | `#D5D5D8` | Light mode borders / dark mode secondary text |
| `gray-300` | `#B4B4B9` | Light mode muted text |
| `gray-400` | `#8E8E95` | Dark mode secondary text |
| `gray-500` | `#6E6E76` | Dark mode muted text / focus rings |
| `gray-600` | `#595960` | Dark mode disabled text / light mode secondary text |
| `gray-700` | `#4A4A50` | Dark mode emphasized borders |
| `gray-800` | `#414146` | Dark mode borders / hover surfaces |
| `gray-900` | `#39393D` | Dark mode card backgrounds |
| `gray-950` | `#252529` | Dark mode surface / popover backgrounds |
| `gray-1000` | `#17171A` | Dark mode body background / light mode primary text |

### Semantic Mapping

#### Light mode

| Token | Value | Notes |
|-------|-------|-------|
| `--background` | `gray-50` | Page body |
| `--foreground` | `gray-1000` | Primary text |
| `--card` | `#FFFFFF` | Card surfaces |
| `--card-foreground` | `gray-1000` | |
| `--popover` | `#FFFFFF` | |
| `--popover-foreground` | `gray-1000` | |
| `--primary` | `gray-1000` | Primary buttons / active states |
| `--primary-foreground` | `gray-50` | Text on primary |
| `--secondary` | `gray-100` | Secondary buttons / muted surfaces |
| `--secondary-foreground` | `gray-1000` | |
| `--muted` | `gray-100` | Muted backgrounds |
| `--muted-foreground` | `gray-600` | Muted text |
| `--accent` | `gray-200` | Hover / emphasis |
| `--accent-foreground` | `gray-1000` | |
| `--border` | `gray-200` | Default borders |
| `--input` | `gray-200` | Input borders |
| `--ring` | `gray-400` | Focus rings |
| `--destructive` | `#DC2626` | Error |
| `--destructive-foreground` | `#FFFFFF` | |
| `--success` | `#26A756` | Success |
| `--success-foreground` | `#FFFFFF` | |
| `--warning` | `#D97706` | Warning |
| `--warning-foreground` | `#FFFFFF` | |
| `--info` | `#2563EB` | Info |
| `--info-foreground` | `#FFFFFF` | |

#### Dark mode

| Token | Value | Notes |
|-------|-------|-------|
| `--background` | `gray-1000` | Deep graphite page body |
| `--foreground` | `gray-100` | Off-white primary text |
| `--card` | `gray-900` | Elevated card surfaces |
| `--card-foreground` | `gray-100` | |
| `--popover` | `gray-950` | |
| `--popover-foreground` | `gray-100` | |
| `--primary` | `gray-100` | Near-white accent for active items |
| `--primary-foreground` | `gray-1000` | Dark text on light accent |
| `--secondary` | `gray-900` | Secondary surfaces |
| `--secondary-foreground` | `gray-100` | |
| `--muted` | `gray-900` | Muted backgrounds |
| `--muted-foreground` | `gray-500` | Muted text |
| `--accent` | `gray-800` | Hover / emphasis |
| `--accent-foreground` | `gray-100` | |
| `--border` | `gray-800` | Subtle borders |
| `--input` | `gray-800` | |
| `--ring` | `gray-500` | Focus rings |
| `--destructive` | `#F87171` | Brighter red for dark |
| `--destructive-foreground` | `#17171A` | |
| `--success` | `#4ADE80` | Brighter green for dark |
| `--success-foreground` | `#17171A` | |
| `--warning` | `#FBBF24` | Brighter amber for dark |
| `--warning-foreground` | `#17171A` | |
| `--info` | `#60A5FA` | Brighter blue for dark |
| `--info-foreground` | `#17171A` | |

### Astryx Token Overrides

`src/lib/theme.ts` should also set `color: { accent: "#A3A3A3", neutralStyle: "neutral", contrast: "standard" }` so Astryx's generated neutral tokens stay pure graphite rather than cool-tinted. The explicit token overrides below then take precedence for every visible surface:

Key token overrides:

| Token | Light | Dark |
|-------|-------|------|
| `--color-background-body` | `gray-50` | `gray-1000` |
| `--color-background-surface` | `#FFFFFF` | `gray-950` |
| `--color-background-card` | `#FFFFFF` | `gray-900` |
| `--color-background-popover` | `#FFFFFF` | `gray-950` |
| `--color-background-muted` | `gray-100` | `gray-900` |
| `--color-text-primary` | `gray-1000` | `gray-100` |
| `--color-text-secondary` | `gray-600` | `gray-400` |
| `--color-text-disabled` | `gray-400` | `gray-600` |
| `--color-text-accent` | `gray-1000` | `gray-100` |
| `--color-icon-primary` | `gray-1000` | `gray-100` |
| `--color-icon-secondary` | `gray-600` | `gray-400` |
| `--color-icon-accent` | `gray-1000` | `gray-100` |
| `--color-border` | `gray-200` | `gray-800` |
| `--color-border-emphasized` | `gray-300` | `gray-700` |
| `--color-accent` | `gray-1000` | `gray-100` |
| `--color-accent-muted` | `gray-200/20` | `gray-800/50` |
| `--color-on-accent` | `gray-50` | `gray-1000` |
| `--color-track` | `gray-200` | `gray-800` |
| `--color-skeleton` | `gray-200` | `gray-800` |
| `--color-shadow` | `rgba(0,0,0,0.08)` | `rgba(0,0,0,0.5)` |
| `--color-error` | `#DC2626` | `#F87171` |
| `--color-error-muted` | `#EF44441A` | `#F871711A` |
| `--color-success` | `#26A756` | `#4ADE80` |
| `--color-success-muted` | `#22C55E1A` | `#4ADE801A` |

### Chart / Data-Visualization Palette

Tailwind variables `--chart-1` through `--chart-12` are defined in `src/styles.css` and consumed by widgets via `var(--chart-N)`. The new palette is muted so it works on dark graphite but still distinguishes multiple series.

| Variable | Hex | Description |
|----------|-----|-------------|
| `--chart-1` | `#A3A3A3` | Primary graphite |
| `--chart-2` | `#7DD3FC` | Soft cyan |
| `--chart-3` | `#FDBA74` | Muted amber |
| `--chart-4` | `#86EFAC` | Soft green |
| `--chart-5` | `#FCA5A5` | Soft red |
| `--chart-6` | `#C4B5FD` | Soft violet |
| `--chart-7` | `#93C5FD` | Soft blue |
| `--chart-8` | `#FDE047` | Soft yellow |
| `--chart-9` | `#67E8F9` | Bright cyan |
| `--chart-10` | `#F9A8D4` | Soft pink |
| `--chart-11` | `#5EEAD4` | Teal |
| `--chart-12` | `#D1D5DB` | Light gray |

Light mode will use the same hex values; they will read brighter against light backgrounds. A future light-mode polish may desaturate them.

### Accent Preset

The `[data-accent="cortex"]` preset in `src/styles.css` should align with the graphite accent:

- Light: `--primary: gray-1000`, `--ring: gray-400`, `--sidebar-primary: gray-1000`, `--chart-1: #A3A3A3`.
- Dark: `--primary: gray-100`, `--primary-foreground: gray-1000`, `--ring: gray-500`, `--sidebar-primary: gray-100`, `--sidebar-primary-foreground: gray-1000`, `--chart-1: #A3A3A3`.

## Files to Change

1. `packages/dashboard-next/src/lib/theme.ts` — Astryx token definitions.
2. `packages/dashboard-next/src/lib/theme.css` — Regenerated via `astryx theme build src/lib/theme.ts --out src/lib/theme.css`.
3. `packages/dashboard-next/src/styles.css` — Tailwind/shadcn variables, chart palette, accent presets.
4. `packages/dashboard-next/src/lib/status.ts` — Review hard-coded status colors and align with new tokens if needed.

## Implementation Steps

1. Update `src/lib/theme.ts` with the new graphite tokens.
2. Run `astryx theme build src/lib/theme.ts --out src/lib/theme.css` (or the equivalent pnpm script) to regenerate `src/lib/theme.css`.
3. Update `src/styles.css` root variables for light mode and `.dark` variables for dark mode.
4. Expand chart variables from `--chart-1`…`--chart-5` to `--chart-1`…`--chart-12`.
5. Update `[data-accent="cortex"]` light and dark presets.
6. Review `src/lib/status.ts` for hard-coded colors and update to new success/warning/error tokens.
7. Run `pnpm lint` and the dashboard dev/build command to verify no broken tokens.
8. Manually inspect the Overview page for text contrast and chart readability.

## Verification

- `pnpm lint` passes.
- `pnpm build` (or dev server) starts without CSS/token errors.
- Overview page dark mode shows graphite background, off-white text, and muted chart colors.
- Light mode still renders correctly (no regressions).

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Regenerated `theme.css` drifts from `theme.ts` | Always regenerate after editing `theme.ts`; do not hand-edit `theme.css`. |
| Some components use hard-coded colors outside tokens | Search for hex literals in `src/` and migrate them to tokens as part of the implementation plan. |
| Chart colors may look too bright in light mode | Acceptable for first pass; light-mode chart desaturation is a follow-up task. |

## Future Work

- Light-mode chart color desaturation.
- Add a theme-switcher smoke test that captures screenshots of light and dark Overview.
