/**
 * /api/services/[id]/health — read health history + trigger a recheck.
 *
 * The recheck path performs a live probe against the service's health_url,
 * updates the services catalog row, and records a snapshot in
 * service_health_log.
 */

import { z } from 'zod';
import { desc, eq } from 'drizzle-orm';
import { defineRoute } from '$lib/server/route-helper';
import { getDb } from '$lib/server/db/client';
import {
	getServiceById as dbGetServiceById,
	getServiceBySlug as dbGetServiceBySlug,
	updateService as dbUpdateService,
} from '$lib/server/db/repos/services';
import { serviceHealthLog } from '$lib/server/db/schema';
import { notFoundError, systemError } from '$lib/server/errors/types';
import * as stub from '$lib/server/stub-data';
import type { RequestEvent } from '$lib/server/types';

const RecheckInput = z.object({
	/** Optional override source — defaults to manual. */
	source: z.enum(['auto', 'manual', 'scheduled']).default('manual'),
});

function idFromParams(event: RequestEvent): string {
	return (event.params as { id: string }).id;
}

async function lookupService(rawId: string) {
	try {
		const db = getDb();
		const numeric = Number(rawId);
		if (!Number.isNaN(numeric) && String(numeric) === rawId) {
			return await dbGetServiceById(db, numeric);
		}
		return await dbGetServiceBySlug(db, rawId);
	} catch {
		return stub.getServiceById(rawId) ?? stub.getServiceBySlug(rawId);
	}
}

async function loadHealthLogs(serviceId: string | number, limit: number) {
	try {
		const db = getDb();
		const logs = await db
			.select()
			.from(serviceHealthLog)
			.where(eq(serviceHealthLog.serviceId, serviceId as number))
			.orderBy(desc(serviceHealthLog.checkedAt))
			.limit(limit);
		return logs.map((log) => ({
			id: `shs_${log.id}`,
			serviceId,
			status: log.status,
			latencyMs: log.responseTimeMs ?? null,
			checkedAt: log.checkedAt instanceof Date ? log.checkedAt.toISOString() : String(log.checkedAt),
			note: null as string | null,
		}));
	} catch {
		return stub.listHealthForService(String(serviceId), limit).map((log, idx) => ({
			id: `shs_stub_${idx}`,
			serviceId: log.serviceId,
			status: log.status,
			latencyMs: log.latencyMs ?? null,
			checkedAt: log.checkedAt,
			note: null as string | null,
		}));
	}
}

async function persistHealthRecheck(
	svc: { id: string | number; slug: string; healthUrl: string | null; healthType: string },
	result: { status: 'online' | 'offline' | 'unknown'; responseMs: number | null; note: string },
) {
	try {
		const db = getDb();
		const updated = await dbUpdateService(db, svc.id as number, {
			status: result.status,
			responseMs: result.responseMs,
			lastCheckAt: new Date(),
		});
		if (!updated) throw new Error('update failed');
		try {
			await db.insert(serviceHealthLog).values({
				serviceId: svc.id as number,
				status: result.status,
				responseTimeMs: result.responseMs ?? null,
				checkedAt: new Date(),
			});
		} catch {
			// best-effort
		}
		return true;
	} catch {
		const existing = stub.getServiceById(String(svc.id)) ?? stub.getServiceBySlug(svc.slug);
		if (existing) {
			stub.updateService(existing.id, { status: result.status });
		}
		stub.recordHealth({
			serviceId: String(svc.id) as import('$lib/server/entities').ServiceId,
			status: result.status,
			latencyMs: result.responseMs ?? null,
			checkedAt: new Date().toISOString(),
		});
		return true;
	}
}

interface ProbeResult {
	status: 'online' | 'offline' | 'unknown';
	responseMs: number | null;
	note: string;
}

async function probeHealth(url: string, type: string): Promise<ProbeResult> {
	if (type !== 'http' || !url || url === '#' || !url.startsWith('http')) {
		return { status: 'unknown', responseMs: null, note: 'Unsupported probe type' };
	}

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 10_000);
	const start = Date.now();

	try {
		const res = await fetch(url, {
			method: 'GET',
			signal: controller.signal,
			headers: { 'User-Agent': 'CortexOS-HealthBot/1.0' },
		});
		const ms = Date.now() - start;
		if (res.ok) {
			return { status: 'online', responseMs: ms, note: `HTTP ${res.status}` };
		}
		return { status: 'offline', responseMs: ms, note: `HTTP ${res.status}` };
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Probe failed';
		return { status: 'offline', responseMs: null, note: message };
	} finally {
		clearTimeout(timeout);
	}
}

export const GET = defineRoute({
	methods: ['GET'],
	auth: 'any',
	surface: 'services',
	action: 'services.health.list',
	target: (_i, e) => idFromParams(e),
	rateLimit: { limit: 60, windowSec: 60, bucket: 'user' },
	handler: async ({ event }) => {
		const rawId = idFromParams(event);
		const svc = await lookupService(rawId);
		if (!svc) throw notFoundError(`Service ${rawId} not found`, 'service');

		const limit = Number(event.url.searchParams.get('limit') ?? '100');
		const clamped = Math.max(1, Math.min(1000, limit));

		const snapshots = await loadHealthLogs(svc.id, clamped);

		return { snapshots };
	},
});

export const POST = defineRoute({
	methods: ['POST'],
	input: RecheckInput,
	auth: 'admin',
	surface: 'services',
	action: 'services.health.recheck',
	target: (_i, e) => idFromParams(e),
	rateLimit: { limit: 10, windowSec: 60, bucket: 'user' },
	handler: async ({ event, input }) => {
		const rawId = idFromParams(event);
		const svc = await lookupService(rawId);
		if (!svc) throw notFoundError(`Service ${rawId} not found`, 'service');

		const result = await probeHealth(svc.healthUrl ?? '', svc.healthType);

		const persisted = await persistHealthRecheck(
			{ id: svc.id, slug: svc.slug, healthUrl: svc.healthUrl, healthType: svc.healthType },
			result,
		);

		if (!persisted) {
			throw systemError('Failed to persist health probe result');
		}

		return {
			snapshot: {
				status: result.status,
				responseMs: result.responseMs,
				checkedAt: new Date().toISOString(),
				note: result.note,
				requested: input,
			},
		};
	},
});
