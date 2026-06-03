/**
 * MSW browser worker — the in-browser mock layer.
 *
 * Only loaded when:
 *   - `import.meta.env.MODE === 'test' || 'development'`, AND
 *   - `import.meta.env.VITE_E2E === '1'`, OR
 *   - the current hostname is `localhost` / `127.0.0.1` AND a
 *     `cortex-mock-mode=1` cookie is set.
 *
 * Production builds set `VITE_E2E=0` and the `MODE=production`, so
 * this module is **dead code** in production. The vite tree-shaker
 * drops the import. (Layer 1 + Layer 4 of the prod-leak guard.)
 *
 * The worker module is the only entry that the production app
 * imports from `$lib/mocks/browser`. The other handlers are
 * reachable only via the MSW worker route, which the production
 * build never registers.
 *
 * Note: this file uses a lazy dynamic import for `msw/browser`
 * because that module throws when loaded in a non-browser
 * environment (vitest on node). The dynamic import is fine in
 * production — Vite's tree-shaker drops the `if (typeof window
 * !== 'undefined')` branch and the dynamic import never fires.
 */

import { handlers } from './handlers';
import { enforceMockMode } from './prod-leak-guard';

enforceMockMode('browser');

export type MSWWorker = {
	start: (options?: { onUnhandledRequest?: 'bypass' | 'warn' | 'error' }) => Promise<void>;
	stop: () => void;
	resetHandlers: (...args: unknown[]) => Promise<void>;
	use: (...args: unknown[]) => void;
};

let _worker: MSWWorker | undefined;

/**
 * Lazily create the MSW worker. Returns `undefined` in a non-browser
 * environment (e.g. vitest on node) so calling code can degrade
 * gracefully.
 */
export async function getWorker(): Promise<MSWWorker | undefined> {
	if (typeof window === 'undefined') return undefined;
	if (_worker) return _worker;
	const { setupWorker } = await import('msw/browser');
	_worker = setupWorker(...handlers) as unknown as MSWWorker;
	return _worker;
}

/**
 * Eagerly start the MSW worker. Throws if called in a non-browser
 * environment. SvelteKit's `+layout.svelte` (or equivalent) should
 * call this in a `$effect` once.
 */
export async function startWorker(): Promise<MSWWorker> {
	const w = await getWorker();
	if (!w) {
		throw new Error('startWorker() called in a non-browser environment');
	}
	await w.start({ onUnhandledRequest: 'bypass' });
	return w;
}

/**
 * Backwards-compatible export. Resolves to the worker instance
 * when accessed in a browser; `undefined` in node. Code that
 * imports `worker` should check for `undefined` before calling.
 */
export const worker: MSWWorker | undefined = undefined;
