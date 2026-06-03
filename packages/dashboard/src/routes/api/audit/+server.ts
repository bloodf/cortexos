/**
 * /api/audit — read the audit log.
 *
 * THREAT_MODEL §6.6: read access is gated to the `cortexos-auditor` role
 * (or admin for their own actions; M1 simplifies to admin-only).
 *
 * M1 returns the in-memory chain. M3 swaps to a real DB query with
 * pagination + filter.
 */

import { z } from 'zod';
import { defineRoute } from '$lib/server/route-helper';
import { listAudit } from '$lib/server/audit';

const AuditQueryInput = z.object({
  limit: z.coerce.number().int().min(1).max(1000).default(100),
  offset: z.coerce.number().int().min(0).default(0),
  surface: z.string().optional(),
  actor: z.string().optional(),
  result: z.enum(['success', 'failure', 'denied', 'error']).optional(),
});

export const GET = defineRoute({
  methods: ['GET'],
  input: AuditQueryInput,
  auth: 'admin',
  surface: 'audit',
  action: 'audit.list',
  rateLimit: { limit: 30, windowSec: 60, bucket: 'user' },
  handler: async ({ input }) => {
    const all = listAudit().slice().reverse(); // most recent first
    let filtered = all;
    if (input.surface) filtered = filtered.filter((e) => e.surface === input.surface);
    if (input.actor) filtered = filtered.filter((e) => e.actorUserId === input.actor);
    if (input.result) filtered = filtered.filter((e) => e.result === input.result);
    const total = filtered.length;
    const items = filtered.slice(input.offset, input.offset + input.limit);
    return { items, total, limit: input.limit, offset: input.offset };
  },
});
