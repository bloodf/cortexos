/**
 * /api/alerts — list + create alert rules.
 */

import { z } from 'zod';
import { defineRoute } from '$lib/server/route-helper';
import { createAlertRule, listAlertRules } from '$lib/server/stub-data';

const AlertRuleCreateInput = z.object({
  name: z.string().min(1).max(120),
  query: z.string().min(1).max(2000),
  severity: z.enum(['info', 'warning', 'critical']).default('warning'),
  channels: z.array(z.string().min(1).max(64)).min(0).max(16).default([]),
  enabled: z.boolean().default(true),
});

export const GET = defineRoute({
  methods: ['GET'],
  auth: 'any',
  surface: 'alerts',
  action: 'alerts.list',
  rateLimit: { limit: 60, windowSec: 60, bucket: 'user' },
  handler: async () => {
    return { rules: listAlertRules() };
  },
});

export const POST = defineRoute({
  methods: ['POST'],
  input: AlertRuleCreateInput,
  auth: 'admin',
  surface: 'alerts',
  action: 'alerts.create',
  target: (i) => i.name,
  rateLimit: { limit: 10, windowSec: 60, bucket: 'user' },
  handler: async ({ input }) => {
    const rule = createAlertRule(input);
    return { rule };
  },
});
