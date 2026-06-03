/**
 * /api/services — list + create.
 *
 * M1 stub: validates input, requires auth for create, applies rate limit,
 * audits, and returns mock data. Real DB queries land in M1-WS6.
 */

import { z } from 'zod';
import { defineRoute } from '$lib/server/route-helper';
import {
  createService,
  listServices,
} from '$lib/server/stub-data';
import { approvalRequiredError } from '$lib/server/errors/types';

const ServiceCreateInput = z.object({
  slug: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/, 'slug must be lowercase letters, numbers, and hyphens'),
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional().nullable(),
  healthUrl: z.string().url().optional().nullable(),
  healthType: z.enum(['http', 'tcp', 'docker', 'systemd', 'process']).default('http'),
  category: z.string().min(1).max(64),
  openUrl: z.string().url().optional().nullable(),
  kind: z.enum(['app', 'service', 'docker', 'process']).default('service'),
});

export const GET = defineRoute({
  methods: ['GET'],
  auth: 'any',
  surface: 'services',
  action: 'services.list',
  rateLimit: { limit: 60, windowSec: 60, bucket: 'user' },
  handler: async () => {
    return { services: listServices() };
  },
});

export const POST = defineRoute({
  methods: ['POST'],
  input: ServiceCreateInput,
  auth: 'admin',
  surface: 'services',
  action: 'services.create',
  target: (i) => i.slug,
  rateLimit: { limit: 10, windowSec: 60, bucket: 'user' },
  handler: async ({ input }) => {
    // PB-1 fix analog: creating a service is a privileged op that may
    // require an approval token. For M1 we throw `approval_required` if
    // the request didn't include a token header. M3 will wire the real
    // approval flow.
    const token = (globalThis as { __approvalToken?: string }).__approvalToken;
    if (!token && input.kind === 'docker') {
      // Creating a docker service is considered privileged in M1.
      throw approvalRequiredError('services.create.docker', 60);
    }
    void token;
    const svc = createService({
      slug: input.slug,
      name: input.name,
      description: input.description ?? null,
      healthUrl: input.healthUrl ?? null,
      healthType: input.healthType,
      category: input.category,
      openUrl: input.openUrl ?? null,
      status: 'unknown',
      kind: input.kind,
      envSource: null,
      isActive: true,
      hasWebui: Boolean(input.openUrl),
      showInHealthcheck: true,
      showInWebui: true,
      sortOrder: 0,
    });
    return { service: svc };
  },
});
