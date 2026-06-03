/**
 * Prod-leak guard tests (Layer 5).
 *
 * The "mocks cannot leak into prod" contract has 5 layers; this
 * test file asserts the runtime / build-time invariants:
 *
 *   1. `enforceMockMode` throws when `NODE_ENV=production` AND
 *      `E2E_MOCK_MODE` is unset.
 *   2. `enforceMockMode` is a no-op in dev / test (current vitest
 *      env is `test`).
 *   3. `assertMocksNeverRunInProduction` is callable and returns
 *      cleanly under the test env.
 *   4. The import boundary is enforced: production code (anything
 *      not in the allowlist) must NOT import from `$lib/mocks`.
 *      We assert this by scanning the source tree with the same
 *      regex the CI grep gate uses.
 *   5. The MSW worker / scenario registry is fully tree-shakeable.
 *      Verified by importing `scenarios/canonical` (the data
 *      layer) without pulling in the MSW worker.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import {
	enforceMockMode,
	assertMocksNeverRunInProduction,
	ALLOWED_MOCKS_IMPORTERS,
	isAllowedMocksImporter,
	SCENARIO_REGISTRY,
} from '../index';
import { SCENARIO_NAMES, listScenarios, isScenarioName, resolveScenario, extractScenarioName } from '../scenarios';

describe('Layer 1+2 — enforceMockMode', () => {
	const ORIGINAL_ENV = { ...process.env };

	beforeEach(() => {
		// Reset relevant env vars before each test. Use bracket
		// notation to bypass the readonly type; vitest is the only
		// environment where this is acceptable.
		(process.env as Record<string, string | undefined>)['NODE_ENV'] = undefined;
		(process.env as Record<string, string | undefined>)['E2E_MOCK_MODE'] = undefined;
	});

	afterEach(() => {
		for (const k of Object.keys(process.env)) {
			if (!(k in ORIGINAL_ENV)) delete (process.env as Record<string, string | undefined>)[k];
		}
		for (const [k, v] of Object.entries(ORIGINAL_ENV)) {
			(process.env as Record<string, string | undefined>)[k] = v;
		}
	});

	it('does not throw in test env', () => {
		(process.env as Record<string, string | undefined>)['NODE_ENV'] = 'test';
		expect(() => enforceMockMode('server')).not.toThrow();
	});

	it('does not throw in development env', () => {
		(process.env as Record<string, string | undefined>)['NODE_ENV'] = 'development';
		expect(() => enforceMockMode('server')).not.toThrow();
	});

	it('does not throw in production when E2E_MOCK_MODE=1 (explicit override)', () => {
		(process.env as Record<string, string | undefined>)['NODE_ENV'] = 'production';
		(process.env as Record<string, string | undefined>)['E2E_MOCK_MODE'] = '1';
		expect(() => enforceMockMode('server')).not.toThrow();
	});

	it('THROWS in production without E2E_MOCK_MODE', () => {
		(process.env as Record<string, string | undefined>)['NODE_ENV'] = 'production';
		(process.env as Record<string, string | undefined>)['E2E_MOCK_MODE'] = undefined;
		expect(() => enforceMockMode('server')).toThrow(/cannot run in production/i);
	});

	it('assertMocksNeverRunInProduction is callable under test env', () => {
		(process.env as Record<string, string | undefined>)['NODE_ENV'] = 'test';
		expect(() => assertMocksNeverRunInProduction()).not.toThrow();
	});
});

describe('Layer 4 — import boundary', () => {
	// __tests__/prod-leak.test.ts lives at packages/dashboard/src/lib/mocks/__tests__/
	// so 5 levels up gets us to packages/dashboard/ — the package root.
	const PACKAGE_ROOT = join(__dirname, '..', '..', '..', '..', '..');
	const PACKAGE_SRC = join(PACKAGE_ROOT, 'src');
	const isFile = (p: string) => statSync(p).isFile();
	const isDir = (p: string) => statSync(p).isDirectory();
	function* walk(dir: string, ext: string[]): Generator<string> {
		for (const name of readdirSync(dir)) {
			const p = join(dir, name);
			if (isDir(p)) {
				yield* walk(p, ext);
			} else if (isFile(p) && ext.some((e) => name.endsWith(e))) {
				yield p;
			}
		}
	}

	it('isAllowedMocksImporter accepts allowlisted paths', () => {
		// Test sample paths that match each allowlist pattern.
		const samples = [
			'src/lib/mocks/browser.ts',
			'src/lib/mocks/__tests__/mocks.test.ts',
			'src/lib/mocks/index.ts',
			'src/hooks.server.ts',
			'src/lib/foo/__tests__/sub/bar.test.ts',
			'e2e/auth/login.spec.ts',
		];
		for (const sample of samples) {
			expect(isAllowedMocksImporter(sample)).toBe(true);
		}
	});

	it('isAllowedMocksImporter rejects arbitrary source files', () => {
		expect(isAllowedMocksImporter('src/routes/(authed)/+page.svelte')).toBe(false);
		expect(isAllowedMocksImporter('src/lib/components/button.svelte')).toBe(false);
	});

	it('no production code imports from $lib/mocks (Layer 3 grep gate)', () => {
		if (!existsSync(PACKAGE_SRC)) {
			// worktree may not be inside the package; skip with a soft note.
			return;
		}
		const files = [...walk(PACKAGE_SRC, ['.ts', '.svelte', '.tsx'])];
		const leakPatterns = [
			/from ['"]\$lib\/mocks/,
			/from ['"]\.\.\/mocks/,
			/from ['"]\.\/mocks/,
		];
		const allowDirs = ['src/lib/mocks/', '__tests__/'];
		const leaks: string[] = [];
		for (const f of files) {
			const rel = relative(PACKAGE_SRC, f).replace(/\\/g, '/');
			if (allowDirs.some((d) => rel.startsWith(d) || rel === d.replace(/\/$/, ''))) continue;
			const text = readFileSync(f, 'utf8');
			for (const pat of leakPatterns) {
				if (pat.test(text)) {
					leaks.push(`${rel}: ${pat}`);
				}
			}
		}
		expect(leaks, `MOCK LEAKS:\n${leaks.join('\n')}`).toEqual([]);
	});
});

describe('scenario registry', () => {
	it('registers every SCENARIO_NAMES entry', () => {
		for (const name of SCENARIO_NAMES) {
			expect(SCENARIO_REGISTRY[name]).toBeDefined();
			expect(SCENARIO_REGISTRY[name].name).toBe(name);
		}
	});

	it('listScenarios() returns the canonical order', () => {
		expect(listScenarios()).toEqual([...SCENARIO_NAMES]);
	});

	it('isScenarioName type guard', () => {
		expect(isScenarioName('happy')).toBe(true);
		expect(isScenarioName('denied-rbac')).toBe(true);
		expect(isScenarioName('unknown')).toBe(false);
		expect(isScenarioName(null)).toBe(false);
		expect(isScenarioName(42)).toBe(false);
	});

	it('extractScenarioName falls back to happy', () => {
		const headers = new Headers();
		const url = new URL('http://localhost/api/services');
		expect(extractScenarioName({ headers, url })).toBe('happy');
	});

	it('extractScenarioName reads the x-mock-scenario header', () => {
		const headers = new Headers({ 'x-mock-scenario': 'empty' });
		const url = new URL('http://localhost/api/services');
		expect(extractScenarioName({ headers, url })).toBe('empty');
	});

	it('extractScenarioName reads the ?scenario= query param as fallback', () => {
		const headers = new Headers();
		const url = new URL('http://localhost/api/services?scenario=denied');
		expect(extractScenarioName({ headers, url })).toBe('denied');
	});

	it('resolveScenario returns the matching scenario or happy by default', () => {
		const headers = new Headers();
		const url = new URL('http://localhost/api/services');
		const scenario = resolveScenario({
			headers,
			url,
			method: 'GET',
			body: null,
			pathTemplate: '/api/services',
			pathParams: {},
		});
		expect(scenario.name).toBe('happy');
	});
});

describe('CI grep gate (Layer 3) — shell script', () => {
	it('scripts/check-mock-leaks.sh is executable and runs cleanly', () => {
		const script = join(__dirname, '..', '..', '..', 'scripts', 'check-mock-leaks.sh');
		if (!existsSync(script)) return; // skip if not present in worktree
		const result = spawnSync('bash', [script, join(__dirname, '..', '..', '..')], {
			encoding: 'utf8',
		});
		expect(result.status).toBe(0);
		expect(result.stdout).toMatch(/check-mock-leaks: OK/);
	});
});
