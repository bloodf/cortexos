import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import svelteParser from 'svelte-eslint-parser';
import ts from 'typescript-eslint';
import * as airbnbExt from 'eslint-config-airbnb-extended';
import globals from 'globals';

export default [
	// JS recommended
	js.configs.recommended,
	// TS recommended-type-checked (strict)
	...ts.configs.recommendedTypeChecked,
	// Airbnb-style rules — `configs.base.typescript` is an array of
	// the base JS rules + the typescript-specific overrides. Spread
	// into the top-level config array. Per-file relaxations for
	// tests + .svelte live below.
	...airbnbExt.configs.base.typescript,
	// Svelte
	...svelte.configs['flat/recommended'],
	// Svelte + TS: parser wiring for .svelte files
	{
		files: ['**/*.svelte'],
		languageOptions: {
			parser: svelteParser,
			parserOptions: {
				parser: ts.parser,
				projectService: true,
				extraFileExtensions: ['.svelte']
			}
		}
	},
	// Disable React/JSX rules in Svelte files (Svelte uses runes, not JSX).
	{
		files: ['**/*.svelte'],
		rules: {
			'no-undef': 'off',
			'import/no-unresolved': 'off'
		}
	},
	// Ignore generated / build artefacts
	{
		ignores: [
			'.svelte-kit/**',
			'build/**',
			'dist/**',
			'node_modules/**',
			'coverage/**',
			'static/**',
			'playwright-report/**',
			'test-results/**'
		]
	},
	// Globals
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node
			}
		}
	},
	// Test files: relax
	{
		files: ['**/*.test.ts', '**/*.spec.ts', 'tests/**', '**/*.svelte.test.ts'],
		rules: {
			'@typescript-eslint/no-explicit-any': 'off',
			'import/no-extraneous-dependencies': 'off',
			'@typescript-eslint/no-non-null-assertion': 'off'
		}
	}
];
