# CortexOS Dashboard Color Palette Revamp — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current CortexOS dashboard dark-mode purple/blue palette with a clean graphite theme, improve text contrast, and introduce a muted 12-color chart palette across both Astryx and Tailwind theme layers.

**Architecture:** The dashboard has two theme layers: an Astryx design-system layer (`src/lib/theme.ts` → `src/lib/theme.css`) and a Tailwind/shadcn layer (`src/styles.css`). This plan updates both layers consistently, expands the chart palette from 5 to 12 colors, and verifies the result with lint/build.

**Tech Stack:** TypeScript, Tailwind CSS v4, Astryx design system, Recharts, Vite.

## Global Constraints

- All color changes must support both light and dark modes.
- `src/lib/theme.css` must be regenerated from `src/lib/theme.ts` via `astryx theme build`; do not hand-edit it.
- No new dependencies.
- No component structural changes.
- Run `pnpm lint` and `pnpm build` after code changes.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `packages/dashboard-next/src/lib/theme.ts` | Astryx design-system token definitions. |
| `packages/dashboard-next/src/lib/theme.css` | Generated Astryx CSS; output of `astryx theme build`. |
| `packages/dashboard-next/src/styles.css` | Tailwind/shadcn variables, chart palette, accent presets. |
| `packages/dashboard-next/src/lib/status.ts` | Status helpers (uses CSS variables; verify no hard-coded colors). |

---

### Task 1: Update Astryx theme tokens in `src/lib/theme.ts`

**Files:**
- Modify: `packages/dashboard-next/src/lib/theme.ts`

**Interfaces:**
- Consumes: Existing `defineTheme` API from `@astryxdesign/core/theme`.
- Produces: Updated `cortexTheme` object with graphite tokens.

- [ ] **Step 1: Replace the `tokens` object in `cortexTheme`**

Open `packages/dashboard-next/src/lib/theme.ts`. Replace the `tokens` property (lines 35–60) with the following values. Keep `name: "cortex"`, `typography`, `radius`, and `motion` blocks unchanged. Update `color` to `{ accent: "#A3A3A3", neutralStyle: "neutral", contrast: "standard" }` so Astryx-generated neutral tokens stay pure graphite instead of cool-tinted.

```typescript
  tokens: {
    // Graphite palette: light / dark pairs
    "--color-background-body": ["#F7F7F8", "#17171A"],
    "--color-background-surface": ["#FFFFFF", "#252529"],
    "--color-background-card": ["#FFFFFF", "#39393D"],
    "--color-background-popover": ["#FFFFFF", "#252529"],
    "--color-background-muted": ["#ECECED", "#39393D"],
    "--color-text-primary": ["#17171A", "#ECECED"],
    "--color-text-secondary": ["#595960", "#8E8E95"],
    "--color-text-disabled": ["#8E8E95", "#595960"],
    "--color-text-accent": ["#17171A", "#ECECED"],
    "--color-icon-primary": ["#17171A", "#ECECED"],
    "--color-icon-secondary": ["#595960", "#8E8E95"],
    "--color-icon-accent": ["#17171A", "#ECECED"],
    "--color-border": ["#D5D5D8", "#414146"],
    "--color-border-emphasized": ["#B4B4B9", "#4A4A50"],
    "--color-accent": ["#17171A", "#ECECED"],
    "--color-accent-muted": ["rgba(213, 213, 216, 0.2)", "rgba(65, 65, 70, 0.5)"],
    "--color-on-accent": ["#F7F7F8", "#17171A"],
    "--color-track": ["#D5D5D8", "#414146"],
    "--color-skeleton": ["#D5D5D8", "#414146"],
    "--color-shadow": ["rgba(0, 0, 0, 0.08)", "rgba(0, 0, 0, 0.5)"],
    "--color-error": ["#DC2626", "#F87171"],
    "--color-error-muted": ["rgba(239, 68, 68, 0.1)", "rgba(248, 113, 113, 0.1)"],
    "--color-success": ["#26A756", "#4ADE80"],
    "--color-success-muted": ["rgba(34, 197, 94, 0.1)", "rgba(74, 222, 128, 0.1)"],
  },
```

- [ ] **Step 2: Update the palette comment at the top of the file**

Replace the existing palette comment (lines 6–11) with:

```typescript
/**
 * CortexOS custom Astryx theme.
 *
 * Palette:
 *   - #17171A  rich black background
 *   - #ECECED  off-white primary text
 *   - #39393D  graphite card surface
 *   - #A3A3A3  muted graphite accent
 */
```

- [ ] **Step 3: Verify the file syntax**

Run:

```bash
cd /opt/cortexos/packages/dashboard-next
npx tsc --noEmit -p tsconfig.json
```

Expected: no type errors.

- [ ] **Step 4: Commit**

```bash
git add packages/dashboard-next/src/lib/theme.ts
git commit -m "design(dashboard): update Astryx tokens to graphite palette"
```

---

### Task 2: Regenerate `src/lib/theme.css`

**Files:**
- Modify: `packages/dashboard-next/src/lib/theme.css` (generated)

**Interfaces:**
- Consumes: `src/lib/theme.ts` from Task 1.
- Produces: Updated `src/lib/theme.css` with graphite tokens.

- [ ] **Step 1: Run the Astryx build command**

```bash
cd /opt/cortexos/packages/dashboard-next
npx astryx theme build src/lib/theme.ts --out src/lib/theme.css
```

Expected: command exits 0 and `src/lib/theme.css` is updated with the new token values.

- [ ] **Step 2: Sanity-check the generated file**

Run:

```bash
grep -n "color-background-body" packages/dashboard-next/src/lib/theme.css | head -1
```

Expected output contains `#17171A` for the dark value (e.g. `--color-background-body: light-dark(#F7F7F8, #17171A);`).

- [ ] **Step 3: Commit**

```bash
git add packages/dashboard-next/src/lib/theme.css
git commit -m "design(dashboard): regenerate Astryx theme.css with graphite tokens"
```

---

### Task 3: Update Tailwind light-mode variables in `src/styles.css`

**Files:**
- Modify: `packages/dashboard-next/src/styles.css`

**Interfaces:**
- Consumes: Astryx tokens from `theme.css` (loaded via `@import "./lib/theme.css";`).
- Produces: Updated `:root` CSS variables for shadcn/Tailwind.

- [ ] **Step 1: Replace the `:root` variable block**

Open `packages/dashboard-next/src/styles.css`. Replace the `:root` block (lines 62–101) with:

```css
:root {
  --radius: 0.625rem;
  /* CortexOS graphite palette */
  --background: #F7F7F8;
  --foreground: #17171A;
  --card: #FFFFFF;
  --card-foreground: #17171A;
  --popover: #FFFFFF;
  --popover-foreground: #17171A;
  --primary: #17171A;
  --primary-foreground: #F7F7F8;
  --secondary: #ECECED;
  --secondary-foreground: #17171A;
  --muted: #ECECED;
  --muted-foreground: #595960;
  --accent: #D5D5D8;
  --accent-foreground: #17171A;
  --destructive: #DC2626;
  --destructive-foreground: #FFFFFF;
  --success: #26A756;
  --success-foreground: #FFFFFF;
  --warning: #D97706;
  --warning-foreground: #FFFFFF;
  --info: #2563EB;
  --info-foreground: #FFFFFF;
  --border: #D5D5D8;
  --input: #D5D5D8;
  --ring: #8E8E95;
  --chart-1: #A3A3A3;
  --chart-2: #7DD3FC;
  --chart-3: #FDBA74;
  --chart-4: #86EFAC;
  --chart-5: #FCA5A5;
  --chart-6: #C4B5FD;
  --chart-7: #93C5FD;
  --chart-8: #FDE047;
  --chart-9: #67E8F9;
  --chart-10: #F9A8D4;
  --chart-11: #5EEAD4;
  --chart-12: #D1D5DB;
  --sidebar: #FFFFFF;
  --sidebar-foreground: #17171A;
  --sidebar-primary: #17171A;
  --sidebar-primary-foreground: #F7F7F8;
  --sidebar-accent: #ECECED;
  --sidebar-accent-foreground: #17171A;
  --sidebar-border: #D5D5D8;
  --sidebar-ring: #8E8E95;
}
```

- [ ] **Step 2: Update the light-mode `[data-accent="cortex"]` preset**

Replace the existing light-mode accent preset (lines 143–149, before `.dark [data-accent="cortex"]`) with:

```css
[data-accent="cortex"] {
  --primary: #17171A;
  --ring: #8E8E95;
  --sidebar-primary: #17171A;
  --sidebar-ring: #8E8E95;
  --chart-1: #A3A3A3;
}
```

- [ ] **Step 3: Verify no syntax errors**

Run:

```bash
cd /opt/cortexos/packages/dashboard-next
pnpm lint
```

Expected: lint passes (CSS is linted too).

- [ ] **Step 4: Commit**

```bash
git add packages/dashboard-next/src/styles.css
git commit -m "design(dashboard): update Tailwind light-mode graphite variables"
```

---

### Task 4: Update Tailwind dark-mode variables in `src/styles.css`

**Files:**
- Modify: `packages/dashboard-next/src/styles.css`

**Interfaces:**
- Consumes: Same file from Task 3.
- Produces: Updated `.dark` CSS variables.

- [ ] **Step 1: Replace the `.dark` variable block**

Open `packages/dashboard-next/src/styles.css`. Replace the `.dark` block (lines 103–140 after Task 3 edits) with:

```css
.dark {
  --background: #17171A;
  --foreground: #ECECED;
  --card: #39393D;
  --card-foreground: #ECECED;
  --popover: #252529;
  --popover-foreground: #ECECED;
  --primary: #ECECED;
  --primary-foreground: #17171A;
  --secondary: #39393D;
  --secondary-foreground: #ECECED;
  --muted: #39393D;
  --muted-foreground: #6E6E76;
  --accent: #414146;
  --accent-foreground: #ECECED;
  --destructive: #F87171;
  --destructive-foreground: #17171A;
  --success: #4ADE80;
  --success-foreground: #17171A;
  --warning: #FBBF24;
  --warning-foreground: #17171A;
  --info: #60A5FA;
  --info-foreground: #17171A;
  --border: #414146;
  --input: #414146;
  --ring: #6E6E76;
  --chart-1: #A3A3A3;
  --chart-2: #7DD3FC;
  --chart-3: #FDBA74;
  --chart-4: #86EFAC;
  --chart-5: #FCA5A5;
  --chart-6: #C4B5FD;
  --chart-7: #93C5FD;
  --chart-8: #FDE047;
  --chart-9: #67E8F9;
  --chart-10: #F9A8D4;
  --chart-11: #5EEAD4;
  --chart-12: #D1D5DB;
  --sidebar: #17171A;
  --sidebar-foreground: #ECECED;
  --sidebar-primary: #ECECED;
  --sidebar-primary-foreground: #17171A;
  --sidebar-accent: #39393D;
  --sidebar-accent-foreground: #ECECED;
  --sidebar-border: #414146;
  --sidebar-ring: #6E6E76;
}
```

- [ ] **Step 2: Update the dark-mode `[data-accent="cortex"]` preset**

Replace the existing `.dark [data-accent="cortex"]` preset with:

```css
.dark [data-accent="cortex"] {
  --primary: #ECECED;
  --primary-foreground: #17171A;
  --ring: #6E6E76;
  --sidebar-primary: #ECECED;
  --sidebar-primary-foreground: #17171A;
  --sidebar-ring: #6E6E76;
  --chart-1: #A3A3A3;
}
```

- [ ] **Step 3: Verify no syntax errors**

```bash
cd /opt/cortexos/packages/dashboard-next
pnpm lint
```

Expected: lint passes.

- [ ] **Step 4: Commit**

```bash
git add packages/dashboard-next/src/styles.css
git commit -m "design(dashboard): update Tailwind dark-mode graphite variables"
```

---

### Task 5: Add `--info` to the Tailwind theme inline block

**Files:**
- Modify: `packages/dashboard-next/src/styles.css`

**Interfaces:**
- Consumes: New `--info` and `--info-foreground` variables from Task 3/4.
- Produces: Tailwind theme mapping for `bg-info`, `text-info`, etc.

- [ ] **Step 1: Add `--color-info` and `--color-info-foreground` to `@theme inline`**

In `src/styles.css`, find the `@theme inline` block (starts at line 16). Add the following two lines after the `--color-warning-foreground` entry (around line 40):

```css
  --color-info: var(--info);
  --color-info-foreground: var(--info-foreground);
```

The block should now include `--color-info` and `--color-info-foreground` alongside the other semantic colors.

- [ ] **Step 2: Verify no syntax errors**

```bash
cd /opt/cortexos/packages/dashboard-next
pnpm lint
```

Expected: lint passes.

- [ ] **Step 3: Commit**

```bash
git add packages/dashboard-next/src/styles.css
git commit -m "design(dashboard): expose info color in Tailwind theme"
```

---

### Task 6: Review `src/lib/status.ts` for hard-coded colors

**Files:**
- Read: `packages/dashboard-next/src/lib/status.ts`
- Modify: none expected

**Interfaces:**
- Consumes: `--success`, `--warning`, `--destructive` CSS variables.
- Produces: Confirmation that status helpers are token-driven.

- [ ] **Step 1: Read the file**

```bash
cat packages/dashboard-next/src/lib/status.ts
```

- [ ] **Step 2: Verify all colors come from CSS variables**

Confirm that all color references use `var(--success)`, `var(--warning)`, `var(--destructive)`, `bg-muted-foreground`, or `bg-muted`. No literal hex codes should be present.

Expected result: file is already token-driven; no changes needed.

- [ ] **Step 3: Optional — add `info` status case**

If the `Status` type ever includes an informational state, add a case. This is not required for the current palette revamp. Skip unless the implementer knows of an upcoming feature.

- [ ] **Step 4: Commit (if no changes, skip; if changed, commit)**

If no changes were made, no commit is necessary. If an `info` case was added:

```bash
git add packages/dashboard-next/src/lib/status.ts
git commit -m "feat(dashboard): add info status color case"
```

---

### Task 7: Verify build and visual inspection

**Files:**
- Verify: all changed files

**Interfaces:**
- Consumes: Updated theme files from Tasks 1–6.
- Produces: Working dashboard with new palette.

- [ ] **Step 1: Run the full build**

```bash
cd /opt/cortexos/packages/dashboard-next
pnpm build
```

Expected: build completes without CSS or token errors.

- [ ] **Step 2: Run lint**

```bash
cd /opt/cortexos/packages/dashboard-next
pnpm lint
```

Expected: lint passes.

- [ ] **Step 3: Run typecheck**

```bash
cd /opt/cortexos/packages/dashboard-next
pnpm typecheck
```

Expected: typecheck passes.

- [ ] **Step 4: Start dev server and inspect**

```bash
cd /opt/cortexos/packages/dashboard-next
pnpm dev
```

Open `http://localhost:3080` (or the port printed in the terminal). Switch to dark mode and inspect:

- Background is deep graphite (`#17171A`), not purple/blue.
- Card surfaces are `#39393D`.
- Primary text is off-white (`#ECECED`).
- Secondary/muted text is readable.
- Charts on the Overview page use graphite/cyan/amber/green/red/etc.
- Active sidebar item uses near-white (`#ECECED`).

- [ ] **Step 5: Commit any final fixes**

If the visual inspection required small tweaks, commit them. Otherwise:

```bash
git add -A
git commit -m "design(dashboard): finalize graphite palette build verification" --allow-empty
```

---

## Self-Review

### Spec coverage

| Spec section | Implementing task |
|--------------|-------------------|
| Neutral graphite scale | Tasks 1, 3, 4 |
| Light mode semantic mapping | Task 3 |
| Dark mode semantic mapping | Task 4 |
| Astryx token overrides | Tasks 1, 2 |
| 12-color chart palette | Tasks 3, 4 |
| Accent presets | Tasks 3, 4 |
| Status color review | Task 6 |
| Verification | Task 7 |

### Placeholder scan

No TBD, TODO, "implement later", or vague steps. Every step contains exact file paths, exact hex codes, and exact commands.

### Type consistency

All CSS custom property names (`--info`, `--info-foreground`, `--chart-1`…`--chart-12`) are consistent across `theme.ts`, `styles.css`, and the status helpers.
