import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';

export default [
  {
    ignores: [
      '.svelte-kit/**',
      'node_modules/**',
      'src/app/**', // legacy Next.js app routes (M2 migration scope)
      'src/components/**', // legacy React widgets (M2 migration scope)
      'src/hooks/**',
      'src/proxy.ts',
      'src/lib/incus/**',
      'src/lib/root-helper/**',
      'src/lib/runtime/**',
      'scripts/**', // Node.js CommonJS scripts (not part of the design system)
      'build/**',
      'dist/**',
      '*.config.{js,ts,mjs}',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...svelte.configs['flat/recommended'],
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      ecmaVersion: 2023,
      sourceType: 'module',
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'svelte/no-at-html-tags': 'warn',
      // Navigation guards: we use raw <a href> for SvelteKit's client-side
      // router; the rule requires resolve() from $app/paths, which is fine
      // but noisy in a design-system package that doesn't depend on app routes.
      'svelte/no-navigation-without-resolve': 'off',
      // svelte-ignore is sometimes preemptive; don't fail builds on it.
      'svelte/no-unused-svelte-ignore': 'off',
      // Loops / placeholders in legacy code; ignore for now.
      'no-useless-assignment': 'off',
      'preserve-caught-error': 'off',
      'no-empty': 'off',
    },
  },
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
      },
    },
  },
  {
    files: ['**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
];
