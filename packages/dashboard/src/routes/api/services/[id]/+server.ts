/**
 * /api/services/[id] — read, update, delete one service.
 */

import { z } from 'zod';
import { defineRoute } from '$lib/server/route-helper';
import {
  deleteService,
  getServiceById,
  updateService,
} from '$lib/server/stub-data';
import { notFoundError } from '$lib/server/errors/types';
import type { RequestEvent } from '$lib/server/types';

const ServicePatchInput = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(2000).nullable().optional(),
  healthUrl: z.string().url().nullable().optional(),
  healthType: z.enum(['http', 'tcp', 'docker', 'systemd', 'process']).optional(),
  category: z.string().min(1).max(64).optional(),
  openUrl: z.string().url().nullable().optional(),
  isActive: z.boolean().optional(),
  showInHealthcheck: z.boolean().optional(),
  showInWebui: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
});

function idFromParams(event: RequestEvent): string {
  return (event.params as { id: string }).id;
}

export const GET = defineRoute({
  methods: ['GET'],
  auth: 'any',
  surface: 'services',
  action: 'services.read',
  target: (_i, e) => idFromParams(e),
  rateLimit: { limit: 120, windowSec: 60, bucket: 'user' },
  handler: async ({ event }) => {
    const id = idFromParams(event);
    const svc = getServiceById(id);
    if (!svc) throw notFoundError(`Service ${id} not found`, 'service');
    return { service: svc };
  },
});

export const PATCH = defineRoute({
  methods: ['PATCH'],
  input: ServicePatchInput,
  auth: 'admin',
  surface: 'services',
  action: 'services.update',
  target: (_i, e) => idFromParams(e),
  rateLimit: { limit: 30, windowSec: 60, bucket: 'user' },
  handler: async ({ event, input }) => {
    const id = idFromParams(event);
    const next = updateService(id, input);
    if (!next) throw notFoundError(`Service ${id} not found`, 'service');
    return { service: next };
  },
});

export const DELETE = defineRoute({
  methods: ['DELETE'],
  auth: 'admin',
  surface: 'services',
  action: 'services.delete',
  target: (_i, e) => idFromParams(e),
  rateLimit: { limit: 10, windowSec: 60, bucket: 'user' },
  handler: async ({ event }) => {
    const id = idFromParams(event);
    const ok = deleteService(id);
    if (!ok) throw notFoundError(`Service ${id} not found`, 'service');
    return { success: true };
  },
});
