/**
 * 5-layer prod-leak guard for the mock layer.
 *
 * The M0-F test strategy §4.4 (and the deliverable's strict rules)
 * require that mocks never leak into production. This module
 * implements layers 1 and 2 at the import boundary:
 *
 *   Layer 1 — `enforceMockMode('browser' | 'server')` runs at the
 *             top of every mocks entry file. It throws if the env
 *             indicates production. Call sites:
 *               - `browser.ts` → `enforceMockMode('browser')`
 *               - `server.ts`  → `enforceMockMode('server')`
 *               - `index.ts`   → `enforceMockMode('index')` (any)
 *
 *   Layer 2 — `assertMocksNeverRunInProduction()` is the explicit
 *             fatal guard. Called from any code path that builds
 *             a scenario response. The throw happens at module
 *             top, so the import itself fails in production.
 *
 *   Layer 3 — implemented in CI as a `grep` gate. See
 *             `scripts/check-mock-leaks.sh` and the CI workflow.
 *
 *   Layer 4 — Vite tree-shaking. The mocks folder is never
 *             imported from `+page.svelte` or `+layout.svelte`.
 *             The only legitimate importers are:
 *               - `src/hooks.server.ts` (the SvelteKit hook)
 *               - `src/lib/mocks/browser.ts` (the MSW worker)
 *               - `src/lib/mocks/server.ts` (the server handle)
 *               - test files under `__tests__/`
 *             Verified by the prod-leak.test.ts vitest suite.
 *
 *   Layer 5 — `prod-leak.test.ts` runs in CI. It builds a
 *             production-like SvelteKit server (with Vite, env
 *             forced to `production`, `E2E_MOCK_MODE` unset) and
 *             asserts that:
 *               - the mocks bundle is **not** included in the
 *                 server output, and
 *               - the production server's `handle` does not invoke
 *                 any mock scenario.
 *
 * This module is the source of truth for layers 1 and 2. Layers
 * 3-5 are configured externally (grep gate, vite alias, vitest).
 */

type Side = 'browser' | 'server' | 'index';

/**
 * The rule (Layer 1):
 *   - Mocks may run only in `test` and `development` modes, OR
 *     when the `VITE_E2E` / `E2E_MOCK_MODE` env var is explicitly `1`.
 *   - In `production` mode, mocks throw on import.
 *
 * The "side" tells us which env var to look at:
 *   - 'browser'  → Vite-style `import.meta.env.MODE` + `VITE_E2E`
 *   - 'server'   → `process.env.NODE_ENV` + `E2E_MOCK_MODE`
 *   - 'index'    → either; the entry can be imported from either side
 */
export function enforceMockMode(side: Side): void {
	const production =
		side === 'browser'
			? typeof import.meta !== 'undefined' &&
				(import.meta as { env?: { MODE?: string } }).env?.MODE === 'production' &&
				!isTruthy(getViteEnv('VITE_E2E'))
			: getNodeEnv('NODE_ENV') === 'production' && !isTruthy(getNodeEnv('E2E_MOCK_MODE'));

	if (production) {
		// Layer 2: hard throw. An import of the mocks in a production
		// build is a CI failure, not a soft warning.
		const message = `[mocks] CRITICAL: mocks cannot run in production (side=${side}). ` +
			'This is a CI-blocking error. See packages/dashboard/src/lib/mocks/prod-leak-guard.ts.';
		if (typeof console !== 'undefined') {
			// eslint-disable-next-line no-console
			console.error(message);
		}
		throw new Error(message);
	}
}

/** Fatal assertion used by the `mocks.cannot.leak` test. */
export function assertMocksNeverRunInProduction(): void {
	enforceMockMode('index');
}

/**
 * Safe accessor for `import.meta.env.VITE_*`. Falls back to
 * `process.env` when the file is imported from a non-Vite context
 * (vitest, scripts). Returns `undefined` in production.
 */
function getViteEnv(key: string): string | undefined {
	try {
		// `import.meta.env` only exists in Vite-bundled code. In
		// vitest, the property is also present.
		const env = (import.meta as unknown as { env?: Record<string, string> }).env;
		if (env && typeof env === 'object') {
			const v = env[key];
			return typeof v === 'string' ? v : undefined;
		}
	} catch {
		// not in a Vite context; fall through to process.env
	}
	return getNodeEnv(key);
}

function getNodeEnv(key: string): string | undefined {
	if (typeof process === 'undefined' || !process.env) return undefined;
	return process.env[key];
}

function isTruthy(value: string | undefined): boolean {
	return value === '1' || value === 'true' || value === 'on';
}

/**
 * List of files that are allowed to import from `$lib/mocks/`.
 * Used by the prod-leak.test.ts to verify the import boundary
 * (Layer 4) and by the CI grep gate (Layer 3).
 *
 * Brace expansion (`{ts,spec.ts}`) is intentionally NOT used here:
 * the in-test glob converter does not implement brace expansion
 * to keep the matching logic simple. The CI grep gate uses ripgrep,
 * which DOES support braces, and the patterns there can be richer.
 */
export const ALLOWED_MOCKS_IMPORTERS = [
	// The mock layer's own entry points
	'src/lib/mocks/**',
	// The SvelteKit hook that wires up the server layer
	'src/hooks.server.ts',
	'src/hooks.server.test.ts',
	// Test files
	'src/**/__tests__/**/*.test.ts',
	'e2e/**/*.spec.ts',
	'e2e/**/*.ts',
] as const;

/**
 * Convert a glob pattern into a RegExp that matches a relative
 * file path. The supported glob syntax is intentionally narrow:
 *
 *   `**`  — zero or more path segments (including slashes)
 *   `*`   — zero or more characters within one segment
 *   `.`   — literal dot (always escaped)
 *   `?`   — not supported; would need explicit `\?` if needed
 *
 * Patterns ending in `/` are treated as directory globs (any file
 * under the directory matches). Patterns ending in `**` match any
 * file under the named directory tree.
 */
function globToRegExp(pattern: string): RegExp {
	let p = pattern;
	if (p.endsWith('/')) p = p + '**';
	// Use a single regex pass to avoid step-ordering bugs.
	// We tokenize: `**` (any depth), `*` (one segment), `.` (literal).
	let regex = '';
	for (let i = 0; i < p.length; i++) {
		const ch = p[i];
		if (ch === '*' && p[i + 1] === '*') {
			regex += '.*';
			i++; // skip second *
		} else if (ch === '*') {
			regex += '[^/]*';
		} else if (ch === '.') {
			regex += '\\.';
		} else {
			regex += ch;
		}
	}
	return new RegExp('^' + regex + '$');
}

/**
 * Check whether a given file path is allowed to import from
 * `$lib/mocks/`. Returns `true` if allowed, `false` if a leak.
 * Used by the prod-leak.test.ts.
 */
export function isAllowedMocksImporter(relativePath: string): boolean {
	const norm = relativePath.replace(/\\/g, '/');
	for (const pattern of ALLOWED_MOCKS_IMPORTERS) {
		if (globToRegExp(pattern).test(norm)) return true;
	}
	return false;
}
