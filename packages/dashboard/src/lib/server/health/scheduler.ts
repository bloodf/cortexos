/**
 * Health-check scheduler.
 *
 * The dashboard runs as a long-lived Node process (the systemd
 * `cortex-dashboard.service` → `node build/index.js`). SvelteKit's
 * adapter-node server has no built-in background loop, so without this
 * every service in the catalog sits at `status = 'unknown'` — the
 * `/api/services/[id]/health` POST only probes on an explicit recheck.
 *
 * This module starts ONE process-wide interval (guarded by a module
 * singleton) that probes every active service by its `health_type`,
 * updates the catalog row (`status`, `responseMs`, `lastCheckAt`), and
 * appends a `service_health_log` row. It is started from the server
 * `init` hook (hooks.server.ts) so it runs once per server boot.
 *
 * Probes are intentionally simple and read-only:
 *   http    → GET the health_url; 2xx/3xx = online
 *   tcp     → open a socket to host:port (parsed from health_url, or a
 *             well-known default port for standard databases)
 *   systemd → `systemctl is-active <unit>` (tries <slug> and cortex-<slug>)
 *   docker  → `docker inspect -f '{{.State.Running}}' <name>` (tries
 *             <slug> and cortex-<slug>)
 *   process → `pgrep -f <slug>`
 *   none    → left unknown
 *
 * Non-http probes shell out via execFile (no shell, fixed argv). On a
 * non-root / non-Linux host (dev, CI) they simply fail closed to
 * 'unknown' — they never throw out of the scheduler.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { connect } from 'node:net';
import { getDb } from '$lib/server/db/client';
import { listServices, updateService } from '$lib/server/db/repos/services';
import { serviceHealthLog } from '$lib/server/db/schema';

const execFileAsync = promisify(execFile);

/** How often to sweep the whole catalog. */
const INTERVAL_MS = 60_000;
/** Per-probe wall-clock cap. */
const PROBE_TIMEOUT_MS = 8_000;
/** Max probes in flight at once (the catalog is ~50 rows). */
const CONCURRENCY = 8;

type Status = 'online' | 'offline' | 'unknown';
interface ProbeResult {
	status: Status;
	responseMs: number | null;
}

interface CatalogRow {
	id: number;
	slug: string;
	healthType: string;
	healthUrl: string | null;
}

/** Well-known TCP ports for catalog DBs that carry no explicit target. */
const TCP_DEFAULT_PORTS: Record<string, number> = {
	postgresql: 5432,
	mysql: 3306,
	mariadb: 3306,
	mongodb: 27017,
	redis: 6379,
};

// ---------------------------------------------------------------------------
// Probes
// ---------------------------------------------------------------------------

async function probeHttp(url: string): Promise<ProbeResult> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
	const start = Date.now();
	try {
		const res = await fetch(url, {
			method: 'GET',
			signal: controller.signal,
			headers: { 'User-Agent': 'CortexOS-HealthBot/1.0' },
			redirect: 'manual',
		});
		const ms = Date.now() - start;
		// 2xx/3xx = the service answered. 401/403 = it answered but is
		// behind auth (e.g. mongo-express basic-auth) — still "up". Only
		// 404/5xx/network failures count as offline.
		const ok = (res.status >= 200 && res.status < 400) || res.status === 401 || res.status === 403;
		return { status: ok ? 'online' : 'offline', responseMs: ms };
	} catch {
		return { status: 'offline', responseMs: null };
	} finally {
		clearTimeout(timer);
	}
}

function probeTcp(host: string, port: number): Promise<ProbeResult> {
	return new Promise((resolve) => {
		const start = Date.now();
		const socket = connect({ host, port });
		const done = (status: Status) => {
			socket.destroy();
			resolve({ status, responseMs: status === 'online' ? Date.now() - start : null });
		};
		socket.setTimeout(PROBE_TIMEOUT_MS);
		socket.once('connect', () => done('online'));
		socket.once('timeout', () => done('offline'));
		socket.once('error', () => done('offline'));
	});
}

async function probeSystemd(slug: string): Promise<ProbeResult> {
	for (const unit of [slug, `cortex-${slug}`, `${slug}.service`]) {
		try {
			const { stdout } = await execFileAsync('systemctl', ['is-active', unit], {
				timeout: PROBE_TIMEOUT_MS,
			});
			if (stdout.trim() === 'active') return { status: 'online', responseMs: null };
		} catch {
			// is-active exits non-zero when not active; try the next name.
		}
	}
	return { status: 'offline', responseMs: null };
}

async function probeDocker(slug: string): Promise<ProbeResult> {
	for (const name of [slug, `cortex-${slug}`]) {
		try {
			const { stdout } = await execFileAsync(
				'docker',
				['inspect', '-f', '{{.State.Running}}', name],
				{ timeout: PROBE_TIMEOUT_MS },
			);
			if (stdout.trim() === 'true') return { status: 'online', responseMs: null };
			if (stdout.trim() === 'false') return { status: 'offline', responseMs: null };
		} catch {
			// no such container under this name; try the next.
		}
	}
	return { status: 'offline', responseMs: null };
}

async function probeProcess(slug: string): Promise<ProbeResult> {
	// Prefer a matching systemd unit (most CortexOS "process" entries are
	// actually units); fall back to pgrep on the slug.
	const viaSystemd = await probeSystemd(slug);
	if (viaSystemd.status === 'online') return viaSystemd;
	try {
		await execFileAsync('pgrep', ['-f', slug], { timeout: PROBE_TIMEOUT_MS });
		return { status: 'online', responseMs: null };
	} catch {
		return { status: 'offline', responseMs: null };
	}
}

function tcpTargetFor(row: CatalogRow): { host: string; port: number } | null {
	const url = row.healthUrl ?? '';
	const m = url.match(/^(?:tcp:\/\/)?([^:/#]+):(\d+)/);
	if (m) return { host: m[1]!, port: Number(m[2]) };
	const port = TCP_DEFAULT_PORTS[row.slug];
	if (port) return { host: '127.0.0.1', port };
	return null;
}

async function probe(row: CatalogRow): Promise<ProbeResult> {
	switch (row.healthType) {
		case 'http': {
			const url = row.healthUrl ?? '';
			if (!url.startsWith('http')) return { status: 'unknown', responseMs: null };
			return probeHttp(url);
		}
		case 'tcp': {
			const t = tcpTargetFor(row);
			return t ? probeTcp(t.host, t.port) : { status: 'unknown', responseMs: null };
		}
		case 'systemd':
			return probeSystemd(row.slug);
		case 'docker':
			return probeDocker(row.slug);
		case 'process':
			return probeProcess(row.slug);
		default:
			return { status: 'unknown', responseMs: null };
	}
}

// ---------------------------------------------------------------------------
// Sweep
// ---------------------------------------------------------------------------

async function persist(row: CatalogRow, result: ProbeResult): Promise<void> {
	const db = getDb();
	await updateService(db, row.id, {
		status: result.status,
		responseMs: result.responseMs,
		lastCheckAt: new Date(),
	});
	try {
		await db.insert(serviceHealthLog).values({
			serviceId: row.id,
			status: result.status,
			responseTimeMs: result.responseMs ?? null,
			checkedAt: new Date(),
		});
	} catch {
		// snapshot logging is best-effort; the catalog row is the source of truth.
	}
}

/** Run a bounded-concurrency pool over `items`. */
async function pool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
	let i = 0;
	const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
		while (i < items.length) {
			const item = items[i++]!;
			await worker(item);
		}
	});
	await Promise.all(runners);
}

let sweeping = false;

/** Probe every active service once and persist the results. */
export async function sweepOnce(): Promise<{ checked: number }> {
	if (sweeping) return { checked: 0 };
	sweeping = true;
	try {
		const db = getDb();
		const { rows } = await listServices(db, { activeOnly: true, pageSize: 500 });
		const catalog = rows as unknown as CatalogRow[];
		await pool(catalog, CONCURRENCY, async (row) => {
			try {
				const result = await probe(row);
				await persist(row, result);
			} catch {
				// never let one bad row abort the sweep
			}
		});
		return { checked: catalog.length };
	} finally {
		sweeping = false;
	}
}

// ---------------------------------------------------------------------------
// Lifecycle (process singleton)
// ---------------------------------------------------------------------------

let started = false;

/** Start the periodic sweep. Idempotent — safe to call from `init`. */
export function startHealthScheduler(): void {
	if (started) return;
	started = true;
	// Kick an immediate sweep so statuses populate within seconds of boot,
	// then settle into the interval. Errors are swallowed — the scheduler
	// must never crash the server.
	void sweepOnce().catch(() => {});
	const timer = setInterval(() => {
		void sweepOnce().catch(() => {});
	}, INTERVAL_MS);
	// Don't keep the event loop alive solely for the timer.
	if (typeof timer.unref === 'function') timer.unref();
}
