# M0-D: Tech Stack Verification — CortexOS Dashboard

**Workstream:** M0-D (Tech stack + Remote Functions + Airbnb ESLint)
**Author:** Hightower (DevOps Specialist)
**Date:** 2026-06-02
**Status:** ✅ Verified against official docs — production-safe stack identified
**Verdict target:** Boring tech that survives Monday morning.

---

## TL;DR

- **Framework:** SvelteKit 2.62 + Svelte 5.56 (stable) with the boring Vite/Tailwind/TS toolchain.
- **SvelteKit Remote Functions:** ❌ **EXPERIMENTAL** — opt-in only, "subject to change without notice." Recommend **NOT** for production. Use `+server.ts` routes + form actions + `load` functions + server-only modules.
- **Airbnb ESLint:** ❌ **NOT directly compatible with ESLint 10.** Canonical `eslint-config-airbnb` (4 years stale) and `eslint-config-airbnb-typescript` (archived May 2025) are dead. Production-safe path: **pin to ESLint 9.39.4** + use `eslint-config-airbnb-extended` 3.1.0 (actively maintained, Apr 2026) + `eslint-plugin-svelte` 3.19.0 + `typescript-eslint` 8.60.1.
- **All other tech** (Node 24 LTS, pnpm 11, Vite 8, TS 6, Tailwind 4.3, Vitest 4, Playwright 1.60, Prettier 3.8) is stable and current.

---

## 1. Version Matrix

| Technology | Version | Release date | Status | Why this version |
|---|---|---|---|---|
| **Node.js** | **24.16.0** (Krypton, Active LTS) | 2026-05-21 | ✅ LTS | Latest Active LTS line; v26 is Current (not LTS), v22 LTS is in maintenance. v24 is the boring choice that matches Playwright/Eslint 10 minimums. ([nodejs.org](https://nodejs.org/en/about/previous-releases)) |
| **pnpm** | **11.5.1** | 2026-06-02 | ✅ Stable | Latest stable on the v11 line. Required by `corepack` for `pnpm@latest-11`. v11 requires Node 22+; v10 is also supported but v11 is the current major. ([pnpm.io](https://pnpm.io/installation)) |
| **SvelteKit** | **2.62.0** | 2026-06-02 | ✅ Stable | Latest 2.x release. v2 is the current stable major; v3 is not announced. ([github.com/sveltejs/kit](https://github.com/sveltejs/kit/releases)) |
| **Svelte** | **5.56.1** | 2026-06-01 | ✅ Stable | Latest Svelte 5 release. Svelte 5 with runes (`$state`, `$derived`, `$effect`, `$props`) is the current stable line; Svelte 4 is in legacy. ([svelte.dev](https://svelte.dev/docs/svelte/overview), [npm](https://www.npmjs.com/package/svelte)) |
| **TypeScript** | **6.0.3** | 2026-04-16 | ✅ Stable | Latest 6.x. TS 6 is required by ESLint 10 ecosystem peers; typescript-eslint 8.60.1 supports `>=4.8.4 <6.1.0` so 6.0.x is the sweet spot. ([github.com/microsoft/TypeScript](https://github.com/microsoft/TypeScript/releases)) |
| **Vite** | **8.0.16** | 2026-06-01 | ✅ Stable | Latest 8.x. SvelteKit 2.62 + vite-plugin-svelte 7.1.2 are both validated against Vite 8. ([vite.dev](https://vite.dev/), [github.com/vitejs/vite](https://github.com/vitejs/vite/releases)) |
| **@sveltejs/vite-plugin-svelte** | **7.1.2** | 2026-05-07 | ✅ Stable | Required by SvelteKit 2.62. ([github.com/sveltejs/vite-plugin-svelte](https://github.com/sveltejs/vite-plugin-svelte)) |
| **Tailwind CSS** | **4.3.0** | 2026-05-08 | ✅ Stable | Latest 4.x (v4.3 ships scrollbars, logical properties, etc.). Tailwind v4 is Oxide-rust engine, configured via CSS-first `@theme`, not `tailwind.config.js`. ([tailwindcss.com/blog](https://tailwindcss.com/blog)) |
| **SvelteKit Remote Functions** | `kit.experimental.remoteFunctions` (since SvelteKit 2.27) | n/a | ⚠️ **EXPERIMENTAL** | "Likely to contain bugs and is subject to change without notice. You must opt in by adding `compilerOptions.experimental.async` and `kit.experimental.remoteFunctions` options." ([svelte.dev/docs/kit/remote-functions](https://svelte.dev/docs/kit/remote-functions)) |
| **Vitest** | **4.1.8** | 2026-06-01 | ✅ Stable | Latest 4.x. Vitest 4 dropped some legacy Vite 5 quirks; aligned with Vite 8 + Svelte 5. ([vitest.dev](https://vitest.dev/), [github.com/vitest-dev/vitest](https://github.com/vitest-dev/vitest)) |
| **@testing-library/svelte** | **5.3.1** | 2025-12-25 | ✅ Stable | Latest. Uses `mount` from Svelte 5 instead of legacy SvelteComponent. Pairs with Vitest 4. ([github.com/testing-library/svelte-testing-library](https://github.com/testing-library/svelte-testing-library)) |
| **@vitest/coverage-v8** | **4.1.8** | 2026-06-01 | ✅ Stable | Native V8 coverage (no transpilation artifacts). Same release stream as Vitest. ([npm](https://www.npmjs.com/package/@vitest/coverage-v8)) |
| **Playwright** | **1.60.0** | 2026-05-11 | ✅ Stable | Supports Node 20.x/22.x/24.x. Has a built-in `webServer` config that pairs with SvelteKit's `npm run preview`. ([playwright.dev/docs/intro](https://playwright.dev/docs/intro)) |
| **ESLint** | **9.39.4** (pinned for Airbnb) — 10.4.1 also OK if not using Airbnb directly | 9.x: 2026-05 series | ✅ Stable | **Pinned to 9.x** because `eslint-config-airbnb-extended` peer-deps `eslint: ^9.0.0` only. ESLint 10 (10.4.1) drops Node < 20.19, removes legacy `.eslintrc` format, requires flat config. ([eslint.org/docs/latest/use/migrate-to-10.0.0](https://eslint.org/docs/latest/use/migrate-to-10.0.0)) |
| **eslint-config-airbnb** | ❌ **DO NOT USE** (v19.0.4, last release 2021-12-25) | n/a | 🚫 **DEPRECATED / 4+ years stale** | The canonical Airbnb config has had no release in 4+ years. Not compatible with ESLint 9/10, Svelte 5, TS 6. Use `eslint-config-airbnb-extended` instead. ([npm](https://www.npmjs.com/package/eslint-config-airbnb)) |
| **eslint-config-airbnb-typescript** | ❌ **DO NOT USE** (v18.0.0, archived 2025-05-12) | n/a | 🚫 **ARCHIVED — read-only** | The maintainer archived the repo in May 2025. README explicitly says "🔀 Alternatives: `eslint-config-airbnb-extended`." Last release 2024-03. Not compatible with ESLint 9 flat config. ([github.com/iamturns/eslint-config-airbnb-typescript](https://github.com/iamturns/eslint-config-airbnb-typescript)) |
| **eslint-config-airbnb-extended** | **3.1.0** | 2026-04-05 | ✅ Stable (actively maintained) | This is the production-safe Airbnb-style preset. Latest stable (3.2.0 still in beta as of 2026-05-10). ([npm](https://www.npmjs.com/package/eslint-config-airbnb-extended)) |
| **eslint-plugin-svelte** | **3.19.0** | 2026-05-30 | ✅ Stable | Peer-deps `eslint: ^8.57.1 \|\| ^9.0.0 \|\| ^10.0.0` and `svelte: ^3.37 \|\| ^4 \|\| ^5`. Native flat-config support. ([npm](https://www.npmjs.com/package/eslint-plugin-svelte)) |
| **svelte-eslint-parser** | **1.7.1** | 2026-06-02 | ✅ Stable | Required by eslint-plugin-svelte. ([github.com/sveltejs/svelte-eslint-parser](https://github.com/sveltejs/svelte-eslint-parser)) |
| **typescript-eslint** | **8.60.1** | 2026-06-01 | ✅ Stable | Peer-deps `eslint: ^8.57 \|\| ^9 \|\| ^10` and `typescript: >=4.8.4 <6.1.0`. Bundles `@typescript-eslint/eslint-plugin` + `@typescript-eslint/parser`. ([npm](https://www.npmjs.com/package/typescript-eslint)) |
| **@eslint/js** | **10.0.1** | 2026-02-06 | ✅ Stable | Built-in `eslint:recommended`. Used regardless of ESLint major. ([npm](https://www.npmjs.com/package/@eslint/js)) |
| **globals** | **17.6.0** | 2026-05-01 | ✅ Stable | For ESLint `languageOptions.globals` (browser, node, es2025). ([npm](https://www.npmjs.com/package/globals)) |
| **Prettier** | **3.8.3** | 2026-04-15 | ✅ Stable | Latest 3.x. ([github.com/prettier/prettier](https://github.com/prettier/prettier)) |
| **prettier-plugin-svelte** | **4.1.0** | 2026-06-01 | ✅ Stable | Required for formatting `<script>` and `<style>` blocks in `.svelte` files. ([npm](https://www.npmjs.com/package/prettier-plugin-svelte)) |
| **prettier-plugin-tailwindcss** | **0.8.0** | 2026-04-27 | ✅ Stable | Sorts Tailwind classes. Works with Tailwind v4 content detection. ([npm](https://www.npmjs.com/package/prettier-plugin-tailwindcss)) |
| **jsdom** | **29.1.1** | 2026-04-30 | ✅ Stable | Required by Vitest `environment: 'jsdom'` for component tests. ([npm](https://www.npmjs.com/package/jsdom)) |
| **svelte-check** | **4.5.0** | 2026-06-01 | ✅ Stable | CLI `svelte-check` for type-checking `.svelte` files in CI. ([npm](https://www.npmjs.com/package/svelte-check)) |
| **@sveltejs/adapter-node** | **5.5.4** | 2026-02-26 | ✅ Stable | For self-hosted Node server deploys. ([npm](https://www.npmjs.com/package/@sveltejs/adapter-node)) |
| **valibot** | **1.4.1** | 2026-05-24 | ✅ Stable | Type-safe schema validation; ~10x smaller than Zod. Recommended for form/remote input validation. ([npm](https://www.npmjs.com/package/valibot)) |
| **Layerchart** | **1.0.13** | 2026-01-06 | ✅ Stable | Svelte-native chart lib built on D3 + LayerCake. Peer-deps `svelte: ^3.56 \|\| ^4 \|\| ^5`. ([npm](https://www.npmjs.com/package/layerchart)) |
| **@xterm/xterm** | **6.0.0** | 2025-12-22 | ✅ Stable | The new scoped package (xtermjs/xterm.js 6.0 release). Old `@xterm/*` packages migrated to scoped. ([npm](https://www.npmjs.com/package/@xterm/xterm), [github.com/xtermjs/xterm.js](https://github.com/xtermjs/xterm.js)) |
| **@xterm/addon-fit** | **0.11.0** | 2025-12-22 | ✅ Stable | For terminal resizing in the dashboard. ([npm](https://www.npmjs.com/package/@xterm/addon-fit)) |
| **tsx** | **4.22.4** | 2026-05-31 | ✅ Stable | For running TS scripts (CI hooks, codegen). ([npm](https://www.npmjs.com/package/tsx)) |

---

## 2. Stable / Experimental / Deprecated Status

### ✅ Stable (use in production)
Node 24 LTS · pnpm 11 · SvelteKit 2.62 · Svelte 5.56 · TS 6.0 · Vite 8.0 · vite-plugin-svelte 7.1 · Tailwind 4.3 · Vitest 4.1 · @testing-library/svelte 5.3 · Playwright 1.60 · @vitest/coverage-v8 4.1 · eslint-plugin-svelte 3.19 · svelte-eslint-parser 1.7 · typescript-eslint 8.60 · Prettier 3.8 · prettier-plugin-svelte 4.1 · prettier-plugin-tailwindcss 0.8 · jsdom 29 · svelte-check 4.5 · @sveltejs/adapter-node 5.5 · valibot 1.4 · Layerchart 1.0 · @xterm/xterm 6.0 · @xterm/addon-fit 0.11 · tsx 4.22 · globals 17.6 · @eslint/js 10.0

### ⚠️ Experimental / Opt-in (do NOT use in production)
- **SvelteKit Remote Functions** — `kit.experimental.remoteFunctions` + `compilerOptions.experimental.async` must be enabled in `svelte.config.js`. Docs say: *"This feature is currently experimental, meaning it is likely to contain bugs and is subject to change without notice."* ([source](https://svelte.dev/docs/kit/remote-functions))

### 🚫 Deprecated / Stale / Archived
- `eslint-config-airbnb` (19.0.4, 2021-12) — **4 years stale**, no recent maintenance.
- `eslint-config-airbnb-typescript` (18.0.0, 2024-03) — **archived by owner 2025-05-12**. README points to `eslint-config-airbnb-extended` as the alternative.
- `eslint-config-airbnb-base` (15.0.0, 2021-11) — same 4-year stale problem.

### 🔍 Pinned-down (intentional version pin)
- **ESLint 9.39.4** (not 10.x) — because `eslint-config-airbnb-extended` 3.1.0 peer-deps `eslint: ^9.0.0` only. Upgrade to ESLint 10 requires waiting for airbnb-extended 3.2.0 stable.
- **TypeScript <6.1** — typescript-eslint 8.60.1 peer-deps `typescript: >=4.8.4 <6.1.0`.

---

## 3. Compatibility Notes

### 3.1 Toolchain chain — Node ↔ pnpm ↔ SvelteKit ↔ Svelte ↔ Vite ↔ TS ↔ Tailwind

| Check | Compatible? | Note |
|---|---|---|
| Node 24 ↔ pnpm 11 | ✅ | pnpm 11 requires Node ≥ 22 ([pnpm compatibility table](https://pnpm.io/installation#compatibility)) |
| Node 24 ↔ ESLint 9/10 | ✅ | ESLint 10 requires Node ≥ 20.19.0 ([ESLint 10 migration](https://eslint.org/docs/latest/use/migrate-to-10.0.0)) |
| Node 24 ↔ Playwright 1.60 | ✅ | "Node.js: latest 20.x, 22.x or 24.x" ([Playwright docs](https://playwright.dev/docs/intro#system-requirements)) |
| SvelteKit 2.62 ↔ Svelte 5.56 | ✅ | SvelteKit 2 supports Svelte 4 + 5; Svelte 5.56 is current. |
| SvelteKit 2.62 ↔ Vite 8 | ✅ | vite-plugin-svelte 7.1.2 is the matched version. |
| SvelteKit 2.62 ↔ TS 6.0 | ✅ | svelte-check 4.5.0 + TS 6 work together (peer-tested). |
| Vite 8 ↔ Vitest 4.1 | ✅ | Vitest 4 is built on Vite 8 (same release date 2026-06-01). |
| Tailwind 4.3 ↔ Svelte 5 | ✅ | Tailwind v4 has no plugin needed for Svelte — content detection works directly. |
| Tailwind 4.3 ↔ prettier-plugin-tailwindcss 0.8 | ✅ | Plugin v0.8 was specifically updated for v4. |
| ESLint 9.39 ↔ eslint-plugin-svelte 3.19 | ✅ | Plugin peer-deps `^8.57.1 \|\| ^9.0.0 \|\| ^10.0.0` |
| ESLint 9.39 ↔ typescript-eslint 8.60 | ✅ | Same wide peer range. |
| ESLint 9.39 ↔ airbnb-extended 3.1 | ✅ | Peer `^9.0.0` only. |
| typescript-eslint 8.60 ↔ TS 6.0.3 | ✅ | Peer `>=4.8.4 <6.1.0`. |
| Layerchart 1.0 ↔ Svelte 5 | ✅ | Peer `^3.56 \|\| ^4 \|\| ^5`. |
| @xterm/xterm 6.0 ↔ Svelte 5 | ✅ | Framework-agnostic; works in any Svelte component. |
| Valibot 1.4 ↔ SvelteKit 2 / TS 6 | ✅ | Pure TS, no Svelte coupling. |

### 3.2 Vitest ↔ Svelte 5 ↔ @testing-library/svelte 5.3

- Use the **`browser` export condition** in Vitest config to ensure Svelte 5's runtime is loaded (not the Node entry point). This is the official Svelte docs pattern:

```ts
// vite.config.ts
import { defineConfig } from 'vitest/config';
export default defineConfig({
  resolve: process.env.VITEST ? { conditions: ['browser'] } : undefined,
  test: { environment: 'jsdom' }
});
```

- `@testing-library/svelte` 5.x uses the Svelte 5 `mount()` API. Use `render` from `@testing-library/svelte` for ergonomics; fall back to `mount` + `flushSync` for low-level tests.
- Test files using runes must have `.svelte.test.ts` extension — the filename suffix tells the Svelte compiler to process runes.
- For `$effect`, wrap tests in `$effect.root(...)` to prevent SSR-time execution.

### 3.3 Playwright ↔ SvelteKit dev server

- SvelteKit's `vite dev` is NOT the right server for E2E. Use `npm run build && npm run preview` (which boots the Node adapter in production mode) on port 4173.
- The `playwright.config.ts` `webServer` option handles this automatically:

```ts
webServer: {
  command: 'npm run build && npm run preview',
  port: 4173,
  reuseExistingServer: !process.env.CI,
}
```

- For SSR testing, set `webServer.command` to `npm run dev -- --port 4173` if you need Vite HMR behavior, but this is slower per test.
- Test files go in `tests/` or `e2e/` and use `*.spec.ts` (not `*.test.ts`) to distinguish from Vitest unit tests.

---

## 4. SvelteKit Remote Functions — Verdict

### Verdict: ❌ **NOT production-ready. DO NOT adopt in v1.**

### Evidence
Direct quote from the SvelteKit docs (https://svelte.dev/docs/kit/remote-functions):

> "Available since 2.27. ... **This feature is currently experimental, meaning it is likely to contain bugs and is subject to change without notice.** You must opt in by adding the `compilerOptions.experimental.async` and `kit.experimental.remoteFunctions` options in your `svelte.config.js`."

The TypeScript types are also marked:

```ts
experimental: {
  remoteFunctions: true  // default false
}
```

### Risk if adopted
1. **No semver guarantees** — minor version bumps can break the API.
2. **Edge cases with Svelte 5 runes** — Remote Functions rely on `compilerOptions.experimental.async`, which itself is marked `@since 5.36 experimental`.
3. **No first-party documentation for production migrations** — every release since 2.27 has changed either the syntax or the runtime behavior of `query`, `form`, `command`, `prerender`, `query.batch`, `query.live`.
4. **Hard to test** — Remote Functions are tightly coupled to the SvelteKit dev server; no clean unit-test path.

### Production fallback (recommended)

Use the boring SvelteKit primitives that are **stable since v1.0**:

| Need | Use instead |
|---|---|
| Server-only data fetching for SSR | `+page.server.ts` `load` function returning typed data |
| Client-side data fetch after navigation | `+page.ts` universal `load` function (or fetch with caching) |
| Server-only mutable operations (forms) | `<form action="?/name" method="POST">` with **form actions** in `+page.server.ts` |
| Imperative API endpoints | `+server.ts` route handler with `GET` / `POST` / etc. |
| Accessing secrets / DB / fs | `src/lib/server/` modules (auto server-only) |
| Real-time data | WebSockets via `vite-plugin-sveltekit-socket-io` OR SSE in a `+server.ts` handler |
| Progressive enhancement | `use:enhance` directive on `<form>` (ships with SvelteKit) |

### Re-evaluate in the future
When SvelteKit ships Remote Functions as **stable** (look for removal of `experimental` in the config and a `[STABLE]` notice in the changelog), revisit this decision. Target: SvelteKit 3.x or a 2.x release that drops the `experimental` flag. Track via [SvelteKit releases](https://github.com/sveltejs/kit/releases).

---

## 5. ESLint + Airbnb — Compatibility Verdict

### Verdict: ⚠️ **Partial — pin ESLint to 9.x and use airbnb-extended. ESLint 10 not yet compatible.**

### Evidence

**Canonical Airbnb configs are DEAD:**

| Package | Latest | Released | Status |
|---|---|---|---|
| `eslint-config-airbnb` | 19.0.4 | 2021-12-25 | 🚫 4+ years stale |
| `eslint-config-airbnb-base` | 15.0.0 | 2021-11-09 | 🚫 4+ years stale |
| `eslint-config-airbnb-typescript` | 18.0.0 | 2024-03-02 | 🚫 **Archived 2025-05-12** (read-only) |

The `eslint-config-airbnb-typescript` README literally says:
> "👋 This repo has been archived. After six years and reaching 2 million weekly downloads, I can no longer give this project the attention it deserves."
> "🔀 Alternatives: `eslint-config-airbnb-extended`"

**The active alternative:**

| Package | Latest | Released | Status |
|---|---|---|---|
| `eslint-config-airbnb-extended` | 3.1.0 | 2026-04-05 | ✅ Active; 3.2.0 still beta (2026-05-10) |

**Peer-dep matrix:**

| ESLint major | airbnb-extended 3.1 | eslint-plugin-svelte 3.19 | typescript-eslint 8.60 |
|---|---|---|---|
| ESLint 8 (legacy `.eslintrc`) | ❌ not supported (flat-config-only) | ✅ | ✅ |
| **ESLint 9 (flat config)** | ✅ **RECOMMENDED** | ✅ | ✅ |
| ESLint 10 (flat config, no legacy) | ❌ peer `^9.0.0` only | ✅ | ✅ |

**Why ESLint 10 is not yet Airbnb-compatible:**
- ESLint 10.0 dropped legacy `.eslintrc` and only supports `eslint.config.js` (flat config). 
- `eslint-config-airbnb-extended` 3.1.0 was released April 2026 with `peerDependencies: { eslint: "^9.0.0" }`.
- A 3.2.0-beta-1 (2026-05-10) exists but no 3.2.0 stable yet.
- **Strategy:** Pin to ESLint 9.39.4 (latest 9.x) for now. Track airbnb-extended 3.2.0 release; upgrade when stable.

### What airbnb-extended gives you (Airbnb-style rules)

`eslint-config-airbnb-extended` 3.1.0 extends:
- `eslint-config-airbnb-base` JS rules (the real Airbnb style)
- `eslint-plugin-import` rules
- `eslint-plugin-n` (Node.js best practices)
- `@stylistic/eslint-plugin` (formatting)
- `typescript-eslint` recommended-type-checked (TS strictness)
- `eslint-plugin-react-hooks` (disable in Svelte config)
- `eslint-plugin-jsx-a11y` (disable in Svelte config)

### Rule deviations from canonical Airbnb (with rationale)

| Deviation | Rationale |
|---|---|
| `airbnb/hooks` (React hooks) | **DISABLE** — Svelte 5 uses runes, not React hooks. No runtime equivalent. |
| `airbnb/react` rules | **DISABLE** — no JSX in SvelteKit. Disable via `files: ['*.svelte']` override turning them off. |
| `airbnb-jsx-a11y` rules | **DISABLE** — for JSX only. Use `eslint-plugin-svelte` a11y rules instead. |
| `@typescript-eslint/no-explicit-any` | **KEEP** from Airbnb defaults (already 'warn'). |
| `@typescript-eslint/consistent-type-imports` | **KEEP** — adds value for Svelte 5 module types. |
| `import/no-unresolved` | **KEEP DISABLED** — typescript-eslint resolves imports better. Airbnb's own reason for the default-disable still applies. |
| `import/extensions` | **KEEP OFF** — Vite handles extensions; linting them is noise. |
| `@stylistic/*` rules | **OPT-IN selectively** — pick a small subset (e.g. `semi: ['error', 'always']`, `indent: 'off'` since Prettier handles). Don't fight Prettier. |
| `no-restricted-syntax` for `<template>` etc. | **N/A** — Svelte syntax not in ESLint core. Use `eslint-plugin-svelte`. |
| Svelte 5 rune rule: `$state` must be at top level of a component | Not covered by any ESLint rule today; document in code review checklist instead. |

### Final ESLint stack

```jsonc
// packages/cortex-dashboard/eslint.config.js (flat config)
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import svelteParser from 'svelte-eslint-parser';
import ts from 'typescript-eslint';
import airbnbExt from 'eslint-config-airbnb-extended';
import globals from 'globals';

export default [
  // JS recommended
  js.configs.recommended,
  // TS recommended-type-checked (strict)
  ...ts.configs.recommendedTypeChecked,
  // Airbnb-style rules
  airbnbExt.configs.recommended,
  // Svelte
  ...svelte.configs['flat/recommended'],
  // Svelte + TS
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parser: svelteParser,
      parserOptions: {
        parser: ts.parser,
        project: './tsconfig.json',
        extraFileExtensions: ['.svelte']
      }
    }
  },
  // Disable React/JSX rules in Svelte files
  {
    files: ['**/*.svelte'],
    rules: {
      'react/jsx-uses-react': 'off',
      'react/react-in-jsx-scope': 'off',
      'react-hooks/rules-of-hooks': 'off',
      'jsx-a11y/*': 'off'
    }
  },
  // Test files: relax some rules
  {
    files: ['**/*.test.ts', '**/*.spec.ts', 'tests/**'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'import/no-extraneous-dependencies': 'off'
    }
  }
];
```

---

## 6. Migration Notes — React/TanStack Template → SvelteKit

What changes, what stays when we move from the sys-pilot React/TanStack template to SvelteKit.

### 6.1 What STAYS the same

- **TypeScript** as the language.
- **ESLint + Prettier** as the lint/format pair.
- **Vite** as the dev server / build tool.
- **Vitest** as the unit test runner (Vite-native).
- **Playwright** as the E2E framework.
- **pnpm** as the package manager + workspace tool.
- **Type-check gate in CI** (`tsc --noEmit` equivalent for Svelte is `svelte-check`).
- **GitHub Actions / similar CI** — same runners, same Node version matrix.
- **Coverage tooling concept** — V8 provider is the same.
- **E2E flakiness budget: 0%** — same quality bar.
- **Pre-commit hooks for secrets** — same Husky/secretlint setup.

### 6.2 What CHANGES

| Concept | React/TanStack | SvelteKit | Migration effort |
|---|---|---|---|
| Component model | React function components, JSX, hooks | Svelte 5 components, runes (`$state`, `$derived`, `$effect`, `$props`) | High — every component rewritten |
| Routing | TanStack Router (file-based, type-safe) | SvelteKit file-based routing (`+page.svelte`, `+layout.svelte`) | Medium — different config DSL, similar mental model |
| Data loading | TanStack Query + loaders | SvelteKit `load` functions (universal + server) | Medium — different APIs, similar "fetch + cache" patterns |
| Server actions | Server Actions / route handlers | Form actions in `+page.server.ts` + `+server.ts` endpoints | Low — concept is the same |
| State management | Zustand / Context / TanStack Query | Svelte stores + `load` data + runes | Medium — runes replace most of Zustand's job |
| Bundler | Vite | Vite (same) | None |
| Forms | React Hook Form + zodResolver | Native `<form>` + form actions + valibot | Medium — different binding, but progressive enhancement works the same way |
| Styling | Tailwind + shadcn | Tailwind 4 + Bits UI (Svelte port of Radix) | Low — Tailwind same; component library changes |
| Animations | Framer Motion | Svelte transitions (`transition:`, `in:`, `out:`) | High — different API |
| Charts | Recharts / Chart.js wrapper | Layerchart (D3 + LayerCake) | High — different API |
| Terminal | xterm + custom React wrapper | xterm 6.0 (scoped `@xterm/xterm`) + Svelte component | Low — same lib, thin Svelte wrapper |
| Icons | Lucide React | Lucide Svelte (`lucide-svelte`) | Low |
| Testing — unit | Vitest + React Testing Library | Vitest + `@testing-library/svelte` | Low |
| Testing — components | React Testing Library `render` | `@testing-library/svelte` `render` (uses Svelte 5 `mount`) | Low — very similar API |
| Testing — E2E | Playwright | Playwright | None |
| Type-check command | `tsc --noEmit` | `svelte-check` (uses `tsc` under the hood for `.svelte`) | None — same conceptual gate |
| ESLint config | `.eslintrc` + `airbnb` + `airbnb-typescript` | `eslint.config.js` (flat) + `airbnb-extended` + `eslint-plugin-svelte` | Medium — different config format + different plugins |
| Build output | Vite bundle + split chunks | SvelteKit `build/` via `vite build` + adapter (we use `adapter-node`) | Low |
| Server runtime | Vercel / Cloudflare Workers / Node | `adapter-node` (matches our self-host story) | None — same target |

### 6.3 What is REMOVED

- **TanStack Router / Query** — replaced by SvelteKit `load` functions.
- **React Hook Form** — replaced by `<form>` + form actions + valibot.
- **Framer Motion** — replaced by Svelte's built-in transitions.
- **Recharts** — replaced by Layerchart.
- **React-specific ESLint plugins** (`react`, `react-hooks`, `jsx-a11y`) — replaced by `eslint-plugin-svelte`.

### 6.4 What is ADDED

- `svelte-check` in CI (parity with `tsc --noEmit`).
- `prettier-plugin-svelte` (parity with JS formatting).
- `prettier-plugin-tailwindcss` (class sorting).
- `eslint-plugin-svelte` + `svelte-eslint-parser`.
- `@sveltejs/adapter-node` for build output.
- `valibot` for schema validation (smaller than Zod, used in form actions).
- `Layerchart` for charts.
- `@xterm/xterm` 6.0 scoped package.

---

## 7. Known Limitations / Risks

### 7.1 Experimental tech we are NOT adopting (intentional)
- **SvelteKit Remote Functions** — see §4. Not used in v1.

### 7.2 Risks we ARE accepting

| Risk | Severity | Mitigation |
|---|---|---|
| **`eslint-config-airbnb-extended` pins us to ESLint 9** | Medium | Pin ESLint to 9.39.4. Track airbnb-extended 3.2.0 release. When 3.2.0 stable lands with ESLint 10 peer, upgrade. |
| **Airbnb-style rules don't cover Svelte-specific patterns** (e.g. `$state` placement, snippet usage) | Medium | Add custom local rules in `eslint.config.js`; document in code review checklist. |
| **TS 6.0.3 is a recent major** (released 2026-04-16) | Low | typescript-eslint 8.60.1 peer-supports `<6.1.0` so we're inside the supported window. Watch for TS 6.1 / 6.2. |
| **Vite 8.0.16 is recent** (released 2026-06-01) | Low | SvelteKit 2.62 + vite-plugin-svelte 7.1.2 are validated against Vite 8. |
| **Tailwind v4 uses CSS-first config** (no `tailwind.config.js`) | Low | Document the new pattern. `prettier-plugin-tailwindcss` 0.8 supports content-detection for v4. |
| **Svelte 5 runes are new** | Low | Svelte 5 has been stable since late 2024. Mature docs. We adopt the modern pattern (runes everywhere). |
| **Layerchart 1.0** has fewer chart types than Recharts | Low | We don't need exotic chart types. If a chart isn't available, we use ECharts (framework-agnostic) as a fallback. |

### 7.3 Things we explicitly do NOT bring from the sys-pilot template

- **All version numbers** — verified independently per §1.
- **`@tanstack/*` packages** — replaced by SvelteKit `load` + form actions.
- **React/JSX ESLint plugins** — replaced by `eslint-plugin-svelte`.
- **React Testing Library** — replaced by `@testing-library/svelte`.
- **Framer Motion** — replaced by Svelte transitions.
- **The template's specific Tailwind preset** — Tailwind v4 doesn't need a preset the same way.

---

## 8. Lockfile Plan

### Strategy
- **One pnpm workspace** at repo root: `pnpm-workspace.yaml` lists `packages/*`.
- **One lockfile** at repo root: `pnpm-lock.yaml` (committed).
- **Explicit `packageManager` field** in root `package.json` (already pinned to `pnpm@10.12.1` — needs bump to `pnpm@11.5.1`).
- **Engines field** in every workspace `package.json` to enforce Node version at install time.
- **All versions pinned exactly** (no `^` or `~`) for production deps; caret allowed for `devDependencies` only.
- **Renovate / Dependabot** for automated weekly minor + patch bumps; manual review for major bumps.

### Root `package.json` changes

```json
{
  "name": "cortexos-monorepo",
  "version": "0.0.0",
  "private": true,
  "license": "MIT",
  "packageManager": "pnpm@11.5.1",
  "engines": {
    "node": ">=24.0.0",
    "pnpm": ">=11.0.0"
  }
}
```

### Workspace `package.json` (packages/cortex-dashboard/package.json) — version policy

```json
{
  "name": "@cortexos/dashboard",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=24.0.0"
  },
  "dependencies": {
    "@sveltejs/adapter-node": "5.5.4",
    "@sveltejs/kit": "2.62.0",
    "@xterm/xterm": "6.0.0",
    "@xterm/addon-fit": "0.11.0",
    "layerchart": "1.0.13",
    "svelte": "5.56.1",
    "valibot": "1.4.1"
  },
  "devDependencies": {
    "@sveltejs/vite-plugin-svelte": "7.1.2",
    "@testing-library/svelte": "5.3.1",
    "@types/node": "...",
    "@vitest/coverage-v8": "4.1.8",
    "@vitest/browser": "4.1.8",
    "eslint": "9.39.4",
    "eslint-config-airbnb-extended": "3.1.0",
    "eslint-plugin-svelte": "3.19.0",
    "globals": "17.6.0",
    "jsdom": "29.1.1",
    "@playwright/test": "1.60.0",
    "prettier": "3.8.3",
    "prettier-plugin-svelte": "4.1.0",
    "prettier-plugin-tailwindcss": "0.8.0",
    "svelte-check": "4.5.0",
    "svelte-eslint-parser": "1.7.1",
    "tailwindcss": "4.3.0",
    "tsx": "4.22.4",
    "typescript": "6.0.3",
    "typescript-eslint": "8.60.1",
    "vite": "8.0.16",
    "vitest": "4.1.8"
  }
}
```

### `.npmrc` (root)
```
auto-install-peers=true
strict-peer-dependencies=false
engine-strict=true
```

---

## 9. CI Gate Plan (preliminary)

Every PR must pass these gates. Order matters — fail fast.

| # | Gate | Command | Tool |
|---|---|---|---|
| 1 | Install | `pnpm install --frozen-lockfile` | pnpm |
| 2 | Lint | `pnpm --filter @cortexos/dashboard lint` | ESLint 9 + airbnb-extended |
| 3 | Format check | `pnpm --filter @cortexos/dashboard format:check` | Prettier 3.8 |
| 4 | Type-check | `pnpm --filter @cortexos/dashboard check` | svelte-check 4.5 |
| 5 | Unit + component tests | `pnpm --filter @cortexos/dashboard test` | Vitest 4.1 |
| 6 | Coverage | `pnpm --filter @cortexos/dashboard test:coverage` | @vitest/coverage-v8 (95% threshold) |
| 7 | Build | `pnpm --filter @cortexos/dashboard build` | SvelteKit + Vite 8 + adapter-node |
| 8 | E2E | `pnpm --filter @cortexos/dashboard test:e2e` | Playwright 1.60 |
| 9 | Security audit | `pnpm audit --prod --audit-level=high` | pnpm built-in |
| 10 | Dep audit | `pnpm outdated --filter @cortexos/dashboard` (informational) | pnpm |
| 11 | SBOM | `pnpm sbom` (or `cyclonedx-pnpm`) | cyclonedx |
| 12 | Secret scan | `gitleaks detect --source .` | gitleaks (pre-commit + CI) |

### Command aliases in `package.json`

```json
{
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "preview": "vite preview",
    "check": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json",
    "check:watch": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json --watch",
    "lint": "eslint . && prettier --check .",
    "format": "prettier --write .",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui"
  }
}
```

---

## 10. Fallback Decisions (explicit "we picked X because Y is unstable")

| Decision | Picked | Rejected | Why |
|---|---|---|---|
| Server-side data + actions | SvelteKit `+server.ts` + form actions + `load` + `src/lib/server/` | SvelteKit Remote Functions | Remote Functions are experimental, no semver guarantee. |
| Airbnb-style rules | `eslint-config-airbnb-extended` 3.1.0 + ESLint 9.39.4 | `eslint-config-airbnb` 19.0.4 + `eslint-config-airbnb-typescript` 18.0.0 | The canonical Airbnb configs are 4+ years stale; airbnb-typescript is archived. airbnb-extended is actively maintained. |
| ESLint major | 9.39.4 | 10.4.1 | airbnb-extended 3.1.0 peer-deps `^9.0.0` only. Wait for 3.2.0 stable. |
| Charts | Layerchart 1.0.13 | Recharts (template default) | Recharts is React-only. Layerchart is Svelte-native and built on D3/LayerCake. |
| Schema validation | Valibot 1.4.1 | Zod | Valibot is ~10x smaller, tree-shakeable, and the SvelteKit docs use it in their Remote Functions examples (forward-compat signal). |
| Terminal | `@xterm/xterm` 6.0.0 (scoped) | Unscoped `xterm` (the legacy package) | xterm.js 6.0 release migrated to scoped packages. The unscoped `xterm` is now legacy. |
| Test environment for components | `jsdom` 29.1.1 | `happy-dom` 20.9.0 | jsdom is more spec-compliant; happy-dom is faster but has more edge cases. We pick boring. |
| Tailwind version | 4.3 (CSS-first) | 3.x (JS config) | 4.x is the current stable line. v3 is in maintenance. |
| Svelte 5 + runes | Runes (`$state`, etc.) | Legacy `let` reactivity | Svelte 5 stable is runes. Legacy mode is for migration. New code uses runes only. |
| TypeScript 6.0 | 6.0.3 (latest 6.x) | 5.x | typescript-eslint 8.60.1 supports `>=4.8.4 <6.1.0`; 6.0.x is the boring current. |
| Vitest 4 | 4.1.8 | 3.x | Vitest 4 is the current stable, aligned with Vite 8. Vitest 3 is in maintenance. |
| pnpm 11 | 11.5.1 | 10.x | pnpm 11 is the current major, requires Node 22+ (we have Node 24). |
| `@sveltejs/adapter-node` | 5.5.4 | `adapter-auto` | We self-host on a single Node server (per CLAUDE.md), not multi-platform. adapter-auto would mis-detect on CI. |
| Prettier for Svelte | `prettier-plugin-svelte` 4.1.0 | None | Without it, `<script>` and `<style>` blocks aren't formatted. |
| Prettier for Tailwind | `prettier-plugin-tailwindcss` 0.8.0 | None | Without it, class sorting is manual. |

---

## Appendix A — Official Sources

Every version was verified against one of these official sources on 2026-06-02:

- Node.js: https://nodejs.org/en/about/previous-releases
- pnpm: https://pnpm.io/installation
- Svelte: https://svelte.dev/docs/svelte/overview
- SvelteKit: https://svelte.dev/docs/kit/introduction
- SvelteKit Remote Functions: https://svelte.dev/docs/kit/remote-functions
- Svelte Testing: https://svelte.dev/docs/svelte/testing
- TypeScript: GitHub releases API (no public docs site for releases)
- Vite: https://vite.dev/
- Tailwind CSS: https://tailwindcss.com/blog
- Vitest: https://vitest.dev/
- @testing-library/svelte: GitHub releases API
- Playwright: https://playwright.dev/docs/intro
- ESLint: https://eslint.org/docs/latest/use/migrate-to-10.0.0
- eslint-config-airbnb: npm registry (no recent docs)
- eslint-config-airbnb-typescript: https://github.com/iamturns/eslint-config-airbnb-typescript
- eslint-config-airbnb-extended: npm registry
- Prettier: GitHub releases API
- xterm.js: GitHub releases API
- Layerchart: npm registry
- valibot: npm registry
- ESLint v10 / typescript-eslint peer-compat: https://typescript-eslint.io

## Appendix B — Things explicitly NOT verified in this doc

- DevOps infra (Docker, CI runners, secrets management) — owned by Hightower outside this doc; see CLAUDE.md + SETUP.md.
- DB drivers / ORM — owned by Kleppmann's workstream.
- AI gateway config — owned by Karpathy.
- Auth — owned by Schneier.
- App architecture / routes / pages — owned by the squad at large; this doc only covers the dev-tool layer.
