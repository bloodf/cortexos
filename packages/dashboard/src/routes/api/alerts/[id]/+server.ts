/**
 * /api/alerts/[id] — read, update, delete one alert rule.
 */

import { z } from 'zod';
import { defineRoute } from '$lib/server/route-helper';
import { deleteAlertRule, getAlertRule, updateAlertRule } from '$lib/server/stub-data';
import { notFoundError } from '$lib/server/errors/types';
import type { RequestEvent } from '$lib/server/types';

const AlertRulePatchInput = z.object({
  name: z.string().min(1).max(120).optional(),
  query: z.string().min(1).max(2000).optional(),
  severity: z.enum(['info', 'warning', 'critical']).optional(),
  channels: z.array(z.string()).max(16).optional(),
  enabled: z.boolean().optional(),
});

function idFromParams(event: RequestEvent): string {
  return (event.params as { id: string }).id;
}

export const GET = defineRoute({
  methods: ['GET'],
  auth: 'any',
  surface: 'alerts',
  action: 'alerts.read',
  target: (_i, e) => idFromParams(e),
  rateLimit: { limit: 60, windowSec: 60, bucket: 'user' },
  handler: async ({ event }) => {
    const id = idFromParams(event);
    const rule = getAlertRule(id);
    if (!rule) throw notFoundError(`Alert ${id} not found`, 'alert');
    return { rule };
  },
});

export const PATCH = defineRoute({
  methods: ['PATCH'],
  input: AlertRulePatchInput,
  auth: 'admin',
  surface: 'alerts',
  action: 'alerts.update',
  target: (_i, e) => idFromParams(e),
  rateLimit: { limit: 30, windowSec: 60, bucket: 'user' },
  handler: async ({ event, input }) => {
    const id = idFromParams(event);
    const next = updateAlertRule(id, input);
    if (!next) throw notFoundError(`Alert ${id} not found`, 'alert');
    return { rule: next };
  },
});

export const DELETE = defineRoute({
  methods: ['DELETE'],
  auth: 'admin',
  surface: 'alerts',
  action: 'alerts.delete',
  target: (_i, e) => idFromParams(e),
  rateLimit: { limit: 10, windowSec: 60, bucket: 'user' },
  handler: async ({ event }) => {
    const id = idFromParams(event);
    const ok = deleteAlertRule(id);
    if (!ok) throw notFoundError(`Alert ${id} not found`, 'alert');
    return { success: true };
  },
});
