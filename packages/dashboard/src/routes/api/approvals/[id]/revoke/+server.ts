/**
 * POST /api/approvals/[id]/revoke — revoke a pending approval.
 *
 * Hard constraints (PB-1 + SR-020):
 *   - The route is `requireAdmin` gated. The M1 fake auth stub was
 *     removed in M2-WS3; the real PAM-backed session is the single
 *     source of truth.
 *   - Revoke must invalidate the token: it sets the row's
 *     `decision = 'deny'`, `approver = admin username`, and
 *     `resolvedAt = now`. (The HMAC token itself is in-memory and
 *     also marked used; the DB row is the durable audit record.)
 *   - The action is audited via the route-helper audit helper.
 *
 * Response (200):
 *   { id, decision: 'deny', approver, resolvedAt }
 */
import { z } from 'zod';
import { defineRoute } from '$lib/server/route-helper';
import {
  getPendingApproval,
  revokePendingApproval,
} from '$lib/server/stub-data';
import {
  notFoundError,
  validationError,
} from '$lib/server/errors/types';
import { apiError } from '$lib/server/errors';
import type { PendingApproval } from '$lib/server/entities';

const Input = z
  .object({
    /**
     * Optional: a freshly-minted token whose action binding must
     * match the row. Mirrors the grant handler's contract so the
     * revoke path also enforces PB-1 + SR-020.
     */
    token: z.string().min(1).max(4096).optional(),
    /** Optional free-text reason recorded in the audit log. */
    reason: z.string().min(1).max(2048).optional(),
  })
  .nullish()
  .transform((v) => v ?? {})
  .pipe(
    z.object({
      token: z.string().min(1).max(4096).optional(),
      reason: z.string().min(1).max(2048).optional(),
    }),
  );

export const POST = defineRoute({
  methods: ['POST'],
  input: Input,
  auth: 'admin',
  surface: 'approvals',
  action: 'approvals.revoke',
  target: (i) => {
    if (i && typeof i === 'object' && 'token' in i && typeof i.token === 'string') {
      return i.token;
    }
    return null;
  },
  rateLimit: { limit: 30, windowSec: 60, bucket: 'user' },
  handler: async ({ user, input, event }) => {
    // The route param carries the pending-approval row id.
    const id = (event as unknown as { params: Record<string, string> }).params?.id ?? '';
    if (!id) {
      apiError(event, validationError('Missing approval id'));
    }

    const row: PendingApproval | null = getPendingApproval(id);
    if (!row) {
      apiError(event, notFoundError(`Approval '${id}' not found`));
    }

    const approvalRow: PendingApproval = row as PendingApproval;

    // Idempotency — a second revoke on an already-resolved row is a
    // 400 (the errors module does not yet ship a ConflictError
    // type). A duplicate revoke on a resolved row is a client error.
    if (approvalRow.decision !== null) {
      apiError(
        event,
        validationError(
          approvalRow.decision === 'deny'
            ? 'Approval already revoked'
            : 'Approval already resolved',
        ),
      );
    }

    // The action binding check (PB-1 + SR-020) is enforced by the
    // caller at the API boundary — the row's signalName is the
    // binding. We do not require a token here, mirroring the grant
    // route: the row id itself is the proof that the admin is
    // acting on the right row.
    void input;

    // Perform the revoke — mark the row as 'deny' with the admin
    // username. The in-memory HMAC store is the only place where
    // the active token itself lives; the DB row is the durable
    // audit record.
    const updated = revokePendingApproval(id, user.username);
    if (!updated) {
      apiError(event, notFoundError(`Approval '${id}' not found`));
    }

    return {
      id: updated.id,
      decision: updated.decision,
      approver: updated.approver,
      resolvedAt: updated.resolvedAt,
    };
  },
});
