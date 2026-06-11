// CortexOS — root ESLint flat config (ESLint 9.x)
//
// Boring tech, one source of truth, no snowflakes.
//
// Stack:
//   - ESLint 9.39.4
//   - eslint-config-airbnb-extended 3.1.0  (NOT the stale canonical airbnb)
//   - typescript-eslint 8.60.1
//   - eslint-plugin-svelte 3.19.0
//   - svelte-eslint-parser 1.7.1
//   - @eslint/js 9.39.4
//   - globals 17.6.0
//
// IMPORTANT — the airbnb-extended import path is `configs.base.recommended`.
// The M0-D tech-stack v0.1 example had a one-liner bug
// (`airbnbExt.configs.recommended` — does not exist). This is the correct
// path: `airbnbExtConfigs.base.recommended`. The Node preset lives at
// `airbnbExtConfigs.node.recommended`. The values are ARRAYS of config
// blocks — they must be spread (`...airbnbExtConfigs.base.recommended`).
//
// Per-package overrides are expressed via `files` globs. Workspace-internal
// libs each get their own rule strictness:
//
//   packages/cortex-audit/**        → strict, node + base
//   packages/cortex-mail-guardian/**→ strict, node + base
//   packages/cortex-telemetry/**    → strict, node + base
//   packages/contracts/**           → strictest (zero-tolerance, no console)
//   packages/design-tokens/**       → strictest
//   packages/dashboard-next/**      → react-aware (React 19 + TanStack Start)

import js from '@eslint/js';
import ts from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import svelteParser from 'svelte-eslint-parser';
import { configs as airbnbExtConfigs } from 'eslint-config-airbnb-extended';
import importX from 'eslint-plugin-import-x';
import stylistic from '@stylistic/eslint-plugin';
import n from 'eslint-plugin-n';
import globals from 'globals';

const SRC_GLOBS = ['**/*.{js,jsx,mjs,cjs,ts,tsx,svelte}'];

// Files ESLint should never look at (per-package, framework build outputs, deps)
const IGNORE = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/.svelte-kit/**',
  '**/.next/**',
  '**/out/**',
  '**/coverage/**',
  '**/.turbo/**',
  '**/.wrangler/**',
  '**/.output/**',
  '**/.tanstack/**',
  '**/*.min.js',
  '**/pnpm-lock.yaml',
  // untracked vendored/host-local content, first-party scope per MP-015
  'hermes/**',
  'hermes-webui/**',
  'stacks/**',
  'scripts/**',
  'templates/**',
];

export default [
  // 1) Global ignores
  {
    ignores: IGNORE,
  },

  // 2) JS recommended baseline
  js.configs.recommended,

  // 3) TypeScript recommended (no type-checked — see §1 note at the bottom)
  ...ts.configs.recommended,

  // 4) Airbnb base + Node presets
  //    The Node preset adds n/* rules (camelcase, no-process-env, etc.)
  //    which we want for the backend libs but want off for the SvelteKit
  //    app (browser env). Per-package overrides handle that.
  ...airbnbExtConfigs.base.recommended,
  ...airbnbExtConfigs.base.typescript,
  ...airbnbExtConfigs.node.recommended,

  // 5) Common rule deviations (applied to everything that doesn't override)
  {
    files: SRC_GLOBS,
    // The airbnb-extended config block rules are scoped to their own
    // `files` glob. When we override rules here, we need the plugins
    // registered in the SAME config object so the override can resolve
    // them. Register import-x and @stylistic globally.
    plugins: {
      'import-x': importX,
      '@stylistic': stylistic,
      n,
      '@typescript-eslint': ts.plugin,
    },
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      parser: ts.parser,
      // parserOptions are inherited from airbnb-extended (which sets
      // projectService: true for .ts files). Don't override here.
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2024,
      },
    },
    rules: {
      // ---- Airbnb rules we deliberately TURN OFF (with reason) ----
      // NOTE: airbnb-extended uses `import-x/*` (eslint-plugin-import-x
      // fork), not the canonical `import/*` from eslint-plugin-import.
      // import-x/no-unresolved: false positives for TS path aliases; typescript-eslint handles it
      'import-x/no-unresolved': 'off',
      // import-x/extensions: off — Vite/TS handle extensions; linting them is noise.
      // Also false positives for TS path-alias imports (no TS resolver configured
      // for import-x — same rationale as no-unresolved above).
      'import-x/extensions': 'off',
      // no-console: apps and CLIs legitimately log; per-package override for libs
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      // no-underscore-dangle: we use _id, _count for unused-discard pattern
      'no-underscore-dangle': ['error', { allowAfterThis: true, allow: ['^_'] }],
      // class-methods-use-this: too aggressive for Svelte stores / handlers
      'class-methods-use-this': 'off',
      // max-classes-per-file: not useful in monorepo
      'max-classes-per-file': 'off',
      // no-plusplus: i++ in tests is fine
      'no-plusplus': ['error', { allowForLoopAfterthoughts: true }],
      // lines-between-class-members: stylistic, Prettier handles
      'lines-between-class-members': 'off',
      // object-curly-newline: Prettier handles
      'object-curly-newline': 'off',
      // arrow-body-style: 'off' is fine; Prettier and TS handle readability
      'arrow-body-style': 'off',
      // function-paren-newline: Prettier handles
      'function-paren-newline': 'off',
      // implicit-arrow-linebreak: Prettier handles
      'implicit-arrow-linebreak': 'off',
      // operator-linebreak: Prettier handles
      'operator-linebreak': 'off',
      // @typescript-eslint/indent: Prettier handles
      '@typescript-eslint/indent': 'off',
      // ---- @stylistic/* — turn OFF by default. Prettier handles formatting.
      // Per the TECH_STACK.md verdict: "pick a small subset... indent: 'off'
      // since Prettier handles. Don't fight Prettier."
      '@stylistic/quotes': 'off',
      '@stylistic/semi': 'off',
      '@stylistic/comma-dangle': 'off',
      '@stylistic/comma-spacing': 'off',
      '@stylistic/indent': 'off',
      '@stylistic/indent-binary-ops': 'off',
      '@stylistic/key-spacing': 'off',
      '@stylistic/keyword-spacing': 'off',
      '@stylistic/space-before-function-paren': 'off',
      '@stylistic/space-infix-ops': 'off',
      '@stylistic/space-in-parens': 'off',
      '@stylistic/spaced-comment': 'off',
      '@stylistic/no-trailing-spaces': 'off',
      '@stylistic/multi-line-comment-close': 'off',
      '@stylistic/no-extra-semi': 'off',
      '@stylistic/no-mixed-operators': 'off',
      '@stylistic/no-mixed-spaces-and-tabs': 'off',
      '@stylistic/no-tabs': 'off',
      '@stylistic/padded-blocks': 'off',
      '@stylistic/quote-props': 'off',
      '@stylistic/quote-property-names': 'off',
      '@stylistic/array-bracket-newline': 'off',
      '@stylistic/array-bracket-spacing': 'off',
      '@stylistic/object-property-newline': 'off',
      '@stylistic/object-curly-spacing': 'off',
      '@stylistic/object-curly-newline': 'off',
      '@stylistic/function-call-spacing': 'off',
      '@stylistic/function-call-argument-newline': 'off',
      '@stylistic/function-paren-newline': 'off',
      '@stylistic/arrow-spacing': 'off',
      '@stylistic/implicit-arrow-linebreak': 'off',
      '@stylistic/operator-linebreak': 'off',
      '@stylistic/wrap-iife': 'off',
      '@stylistic/wrap-regex': 'off',
      '@stylistic/template-curly-spacing': 'off',
      '@stylistic/template-tag-spacing': 'off',
      '@stylistic/yield-star-spacing': 'off',
      '@stylistic/brace-style': 'off',
      '@stylistic/curly-newline': 'off',
      '@stylistic/eol-last': 'off',
      '@stylistic/linebreak-style': 'off',
      '@stylistic/lines-around-comment': 'off',
      '@stylistic/lines-between-class-members': 'off',
      '@stylistic/max-len': 'off',
      '@stylistic/multiline-ternary': 'off',
      '@stylistic/newline-per-chained-call': 'off',
      '@stylistic/no-confusing-arrow': 'off',
      '@stylistic/no-multi-spaces': 'off',
      '@stylistic/no-whitespace-before-property': 'off',
      // @typescript-eslint/no-explicit-any: warn (not error) — escape hatch for third-party types
      '@typescript-eslint/no-explicit-any': 'warn',
      // @typescript-eslint/no-unused-vars: warn with underscore pattern
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
      // @typescript-eslint/consistent-type-imports: enforce
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],

      // ---- Type-aware rules from airbnb-extended — turned off because
      // they require parserOptions.projectService + a tsconfig.json per
      // package. Each package can opt in by adding a parserOptions.project
      // override and re-enabling these.
      'n/no-sync': 'off',
      'n/no-unsupported-features/node-builtins': 'off',
      '@typescript-eslint/dot-notation': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/await-thenable': 'off',
      '@typescript-eslint/no-base-to-string': 'off',
      '@typescript-eslint/restrict-plus-operands': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
    },
  },

  // 6) Svelte overrides — only on .svelte files
  //    a) Use svelte-eslint-parser
  //    b) Disable React-only rules from airbnb-extended
  //    c) Apply svelte/recommended rules
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parser: svelteParser,
      parserOptions: {
        parser: ts.parser,
        extraFileExtensions: ['.svelte'],
        // project: not enabled by default — see §1 below. Add per-package.
      },
    },
    plugins: {
      svelte,
    },
    rules: {
      // The React-specific rules from airbnb-extended
      'react/jsx-uses-react': 'off',
      'react/react-in-jsx-scope': 'off',
      'react-hooks/rules-of-hooks': 'off',
      'react-hooks/exhaustive-deps': 'off',
      'jsx-a11y/anchor-has-content': 'off',
      'jsx-a11y/alt-text': 'off',
      'jsx-a11y/click-events-have-key-events': 'off',
      'jsx-a11y/no-static-element-interactions': 'off',
      'jsx-a11y/role-has-required-aria-props': 'off',
      'jsx-a11y/role-supports-aria-props': 'off',
      // Svelte 5 has its own a11y rules in eslint-plugin-svelte
    },
  },
  ...svelte.configs['flat/recommended'],

  // 7) Per-package overrides — stricter for libs, looser for tests/migrations
  // 7a) Workspace-internal libs (contracts, design-tokens, audit, mail-guardian,
  //     telemetry): zero-tolerance, no console, no any, no process.exit
  {
    files: [
      'packages/contracts/**/*.{js,ts}',
      'packages/design-tokens/**/*.{js,ts}',
      'packages/cortex-audit/**/*.{js,ts}',
      'packages/cortex-mail-guardian/**/*.{js,ts}',
      'packages/cortex-telemetry/**/*.{js,ts}',
    ],
    languageOptions: {
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2024,
      },
    },
    rules: {
      'no-console': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      // Node-specific n/* rules from airbnb-extended.node
      'n/no-process-exit': 'error',
      'n/no-process-env': 'error',
      // Type-aware rules (require projectService + tsconfig) are off by
      // default; each package can opt in by setting parserOptions.project.
      // '@typescript-eslint/no-floating-promises': 'error',
      // '@typescript-eslint/no-misused-promises': 'error',
    },
  },

  // 7d) Plain-JS Node packages — Node ESM requires extensions on relative imports
  {
    files: [
      'packages/cortex-audit/**/*.{js,mjs}',
      'packages/cortex-telemetry/**/*.{js,mjs}',
      'packages/cortex-terminal/**/*.{js,mjs}',
    ],
    rules: {
      'import-x/extensions': ['error', 'ignorePackages', { js: 'always', mjs: 'always' }],
    },
  },

  // 7e) Test files — relax typing so test mocks don't block CI.
  {
    files: [
      '**/*.test.{ts,tsx,js,jsx}',
      '**/*.spec.{ts,tsx,js,jsx}',
      '**/__tests__/**/*.{ts,tsx,js,jsx}',
      '**/*.test.ts.snap',
      'vitest.setup.ts',
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-require-imports': 'off',
      'import-x/no-extraneous-dependencies': 'off',
      'no-console': 'off',
    },
  },

  // 7f) Parser coverage — packages without their own tsconfig.json
  {
    files: ['**/*.ts', '**/*.cts', '**/*.mts', '**/*.tsx', '**/*.d.ts'],
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: [
            'packages/cortex-audit/src/index.d.ts',
            'packages/cortex-telemetry/src/index.d.ts',
            'packages/cortex-mail-guardian/test/*.ts',
            'packages/cortex-mail-guardian/vitest.config.ts',
          ],
        },
      },
    },
  },
];

// ---------------------------------------------------------------------------
// §1 — Why NOT `recommendedTypeChecked`?
//
// typescript-eslint's type-checked configs require a `project` field per
// parserOptions. The monorepo has multiple tsconfig.json files (one per
// package + the root), and configuring project service discovery adds
// fragility (CI cache invalidation, IDE drift). For M1 we ship the
// non-type-checked recommended set; per-package overrides below can opt
// into type-aware rules when each package is stable.
//
// When a package wants type-aware rules, add a `parserOptions.project`
// in that package's override block and switch to
// `ts.configs.recommendedTypeChecked`.
// ---------------------------------------------------------------------------
