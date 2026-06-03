/**
 * /api/services/[id]/health — read health history + trigger a recheck.
 */

import { z } from 'zod';
import { defineRoute } from '$lib/server/route-helper';
import {
  getServiceById,
  listHealthForService,
  triggerRecheck,
} from '$lib/server/stub-data';
import { notFoundError } from '$lib/server/errors/types';
import type { RequestEvent } from '$lib/server/types';

const RecheckInput = z.object({
  /** Optional override source — defaults to the service's health_url. */
  source: z.enum(['auto', 'manual', 'scheduled']).default('manual'),
});

function idFromParams(event: RequestEvent): string {
  return (event.params as { id: string }).id;
}

export const GET = defineRoute({
  methods: ['GET'],
  auth: 'any',
  surface: 'services',
  action: 'services.health.list',
  target: (_i, e) => idFromParams(e),
  rateLimit: { limit: 60, windowSec: 60, bucket: 'user' },
  handler: async ({ event }) => {
    const id = idFromParams(event);
    const svc = getServiceById(id);
    if (!svc) throw notFoundError(`Service ${id} not found`, 'service');
    const limit = Number(event.url.searchParams.get('limit') ?? '100');
    const snapshots = listHealthForService(id, Math.max(1, Math.min(1000, limit)));
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
    const id = idFromParams(event);
    const svc = getServiceById(id);
    if (!svc) throw notFoundError(`Service ${id} not found`, 'service');
    const snap = triggerRecheck(id);
    return { snapshot: snap, requested: input };
  },
});
