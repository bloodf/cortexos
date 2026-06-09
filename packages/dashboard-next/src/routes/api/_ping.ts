/**
 * Demo `/api/_ping` route — the WP-01 acceptance proof for `defineApiRoute`.
 *
 * Declares the route the way THIS TanStack Start version expects: a file route
 * with a `server.handlers` map keyed by HTTP method (see the convention note at
 * the top of `src/server/define-api-route.ts` and in `docs/rebuild/STATUS.md`).
 * Each method handler delegates to a `defineApiRoute(...)` core
 * (`(request: Request) => Promise<Response>`).
 *
 * Two cores are exported for the acceptance test:
 *   - `pingAnyCore`   — auth:'any', validates an optional `?n` query → 400 path.
 *   - `pingAdminCore` — auth:'admin', proves 403 for a non-admin user.
 *
 * GET requires a valid session (200 / 401). POST additionally enforces the
 * double-submit, session-bound CSRF check (403 without it).
 */

import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { defineApiRoute, type ApiRouteCore } from '@/server/define-api-route';

const pingInput = z
  .object({
    // Optional numeric echo — coerced from the querystring. A non-numeric
    // value exercises the 400 validation path.
    n: z.coerce.number().int().optional(),
  })
  .strict();

export const pingAnyCore: ApiRouteCore = defineApiRoute({
  methods: ['GET', 'POST'],
  auth: 'any',
  input: pingInput,
  surface: 'system',
  action: 'system.ping',
  handler: ({ user, input }) => ({
    ok: true,
    pong: true,
    user: user ? user.username : null,
    n: (input as { n?: number }).n ?? null,
  }),
});

export const pingAdminCore: ApiRouteCore = defineApiRoute({
  methods: ['GET', 'POST'],
  auth: 'admin',
  input: pingInput,
  surface: 'system',
  action: 'system.ping.admin',
  handler: ({ user }) => ({ ok: true, pong: true, admin: user?.username ?? null }),
});

// The route id MUST be a string literal — the build's route-tree transform
// requires it (a path-less call fails with "expected route id to be a string
// literal"). The router plugin registers '/api/_ping' in routeTree.gen.ts on
// build/dev.
export const Route = createFileRoute('/api/_ping')({
  server: {
    handlers: {
      GET: ({ request }: { request: Request }) => pingAnyCore(request),
      POST: ({ request }: { request: Request }) => pingAnyCore(request),
    },
  },
});
