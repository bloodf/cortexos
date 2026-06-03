import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import svelteParser from 'svelte-eslint-parser';
import ts from 'typescript-eslint';
import * as airbnbExt from 'eslint-config-airbnb-extended';
import globals from 'globals';
// CommonJS import — `eslint-rules/index.cjs` is a CJS module that exports
// an object of rule plugins. We import it via `createRequire` so the
// flat config (ESM) can use the CJS module's default export.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

/** @type {Record<string, import('eslint').Rule.RuleModule>} */
const localRules = require('./eslint-rules/index.cjs');

// The `airbnb-extended` base config references rules from a number of
// plugins (`@stylistic/*`, `import-x/*`, `n/*`, `@typescript-eslint/*`)
// but does NOT register the plugin objects — it expects consumers to do
// that. Pull each plugin out of the `airbnbExt.plugins.*.plugins` map
// and register it under the same key the rules use.
function plugin(name) {
	const wrapper = airbnbExt.plugins[name];
	if (!wrapper) return undefined;
	// Each `plugins.X` is `{ name, files, plugins: { 'actual-key': obj } }`.
	// We want the inner `obj` registered as the actual key.
	const inner = wrapper.plugins;
	const key = Object.keys(inner)[0];
	return inner[key];
}

const pluginsToRegister = {
	'@stylistic': plugin('stylistic'),
	'import-x': plugin('importX'),
	n: plugin('node'),
	'@typescript-eslint': plugin('typescriptEslint')
};

export default [
	// Register the plugins before any config block that
	// references their rules. ESLint resolves plugin rules by looking
	// up the plugin under the rule prefix; without these entries the
	// `@stylistic/comma-dangle`, `import-x/extensions`, and
	// `@typescript-eslint/*` references in airbnb-extended fail.
	{
		plugins: pluginsToRegister
	},
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
			'test-results/**',
			// CJS rule files — they're consumed via createRequire above, not
			// linted as part of the application source.
			'eslint-rules/**'
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
	},
	// SvelteKit +server.ts/+page.server.ts files throw `redirect(...)` and
	// `error(...)` from `@sveltejs/kit`. Those helpers return plain
	// objects (not Error instances), which the strict
	// `only-throw-error` rule rejects. We allow the SvelteKit error
	// types here so the SvelteKit request-lifecycle pattern is
	// expressible. The pattern is fundamental to SvelteKit and used
	// everywhere; relaxing it project-wide is the right call.
	{
		files: ['src/routes/**/+*.ts', 'src/routes/**/+*.svelte.ts'],
		rules: {
			'@typescript-eslint/only-throw-error': 'off'
		}
	},
	// CortexOS local rules — `local/*`. These codify security and
	// correctness invariants (see eslint-rules/index.js for rationale).
	{
		plugins: {
			local: {
				rules: localRules
			}
		},
		rules: {
			'local/no-bash-c-in-template': 'error',
			'local/no-requireauth-in-admin': 'warn'
		}
	},
	// The `require-admin-on-privileged-route` rule is structural and
	// only meaningful in the M1+ backend-skeleton work that will land
	// in M1-WS4. Wire it on for the privileged route trees so it
	// fires the moment the +server.ts files arrive.
	{
		files: [
			'src/routes/admin/**/*.{ts,svelte}',
			'src/routes/api/services/**/*.{ts,svelte}',
			'src/routes/api/commands/**/*.{ts,svelte}',
			'src/routes/api/audit/**/*.{ts,svelte}',
			'src/routes/api/users/**/*.{ts,svelte}'
		],
		rules: {
			'local/require-admin-on-privileged-route': 'error'
		}
	}
];
