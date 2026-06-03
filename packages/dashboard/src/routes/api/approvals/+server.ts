/**
 * /api/approvals — mint approval tokens, consume them, list pending.
 *
 * PB-1 FIX: this route is now `requireAdmin` gated (THREAT_MODEL §3.4,
 * §1.2 surface 2, T-010). The M0-B finding was that POST had no auth
 * gate, allowing any authenticated user (or in some reports, even
 * unauthenticated users via direct API hit) to mint approval tokens.
 *
 * M1 endpoints:
 *   - POST /api/approvals              → mint an approval token (PB-1)
 *   - GET  /api/approvals              → list pending tokens (auditor)
 *   - DELETE /api/approvals?id=...     → revoke a pending token (auditor)
 *
 * The token itself is bound to (actionHash, sessionId) per SR-020.
 */

import { z } from 'zod';
import { defineRoute } from '$lib/server/route-helper';
import { mintApproval, actionHashFor, type ApprovalClaims } from '$lib/server/approval';
import type { RequestEvent } from '$lib/server/types';

const MintInput = z.object({
  /** The action name (e.g. `services.delete`, `systemd.restart:cortex-dashboard`). */
  action: z.string().min(1).max(256),
  /** Payload that the consuming endpoint will send. The hash binds the token. */
  payload: z.record(z.string(), z.unknown()).default({}),
  /** Optional override (default 60s; 300s for `reveal` actions). */
  ttlSec: z.number().int().min(1).max(3600).optional(),
});

export const GET = defineRoute({
  methods: ['GET'],
  auth: 'admin',
  surface: 'approvals',
  action: 'approvals.list',
  rateLimit: { limit: 30, windowSec: 60, bucket: 'user' },
  handler: async () => {
    // M1: in-memory store doesn't expose a list. Return empty + the
    // verifier status. M3 will list from the DB.
    return { pending: [] as ApprovalClaims[] };
  },
});

export const POST = defineRoute({
  methods: ['POST'],
  input: MintInput,
  // PB-1 FIX: admin gate. Without this, M0-B's no-auth-gate prod bug
  // allows non-admins to mint approval tokens.
  auth: 'admin',
  surface: 'approvals',
  action: 'approvals.mint',
  target: (i) => i.action,
  // SR-200: stricter limit for the token-mint endpoint (30/min by IP).
  rateLimit: { limit: 30, windowSec: 60, bucket: 'ip' },
  handler: async ({ user, event, input }) => {
    const sessionId = event.locals.session?.id;
    if (!sessionId) {
      // requireAdmin already ensured a session, but we guard here too.
      throw new Error('Session required for approval minting');
    }
    const ttl =
      input.ttlSec ?? (input.action.startsWith('reveal.') ? 300 : 60);
    const token = mintApproval({
      action: input.action,
      payload: input.payload,
      sessionId,
      userId: user.id,
      ttlSec: ttl,
    });
    return {
      token: token.token,
      expiresAt: token.expiresAt,
      issuedAt: token.issuedAt,
      actionHash: token.actionHash,
      ttlSec: token.ttlSec,
    };
  },
});

export const DELETE = defineRoute({
  methods: ['DELETE'],
  auth: 'admin',
  surface: 'approvals',
  action: 'approvals.revoke',
  target: (_i, e) => e.url.searchParams.get('id') ?? '',
  rateLimit: { limit: 30, windowSec: 60, bucket: 'user' },
  handler: async () => {
    // M1 stub. M3: mark the DB row as revoked.
    return { success: true };
  },
});

/** Exposed for tests + the M1 routes that need to compute the same hash. */
export { actionHashFor, type RequestEvent };
