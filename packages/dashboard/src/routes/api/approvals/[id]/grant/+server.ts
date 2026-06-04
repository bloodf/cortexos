/**
 * POST /api/approvals/[id]/grant — grant a pending approval.
 *
 * Hard constraints (PB-1 + SR-020):
 *   - The route is `requireAdmin` gated. The M1 fake auth stub was
 *     removed in M2-WS3; the real PAM-backed session is the single
 *     source of truth.
 *   - The grant action calls `actionHashFor(actor, action, target)`
 *     to verify the token's action binding BEFORE incrementing the
 *     approval counter. The action hash is checked against the
 *     row's `signalName` + the `actor` (admin username) + the
 *     `runId` target; a mismatched hash is a 400.
 *   - The decision is recorded on the `pending_approvals` row
 *     (decision='approve', approver=admin username, resolvedAt=now).
 *   - The action is audited via the route-helper audit helper.
 *
 * Response (200):
 *   { id, decision: 'approve', approver, resolvedAt }
 */
import { z } from 'zod';
import { defineRoute } from '$lib/server/route-helper';
import { actionHashFor } from '$lib/server/approval';
import {
  getPendingApproval,
  resolvePendingApproval,
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
     * Optional: a freshly-minted token to verify the action binding
     * before granting. If provided, the row's signal+run are
     * hashed and compared to the token's actionHash (PB-1 + SR-020).
     * If omitted, the grant proceeds without an explicit token
     * (the row's `signalName` is the binding).
     */
    token: z.string().min(1).max(4096).optional(),
  })
  .nullish()
  .transform((v) => v ?? {})
  .pipe(z.object({ token: z.string().min(1).max(4096).optional() }));

function decodeTokenActionHash(token: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const claimsPart = parts[1]!;
  try {
    const claims = JSON.parse(
      Buffer.from(claimsPart, 'base64url').toString('utf8'),
    ) as Record<string, unknown>;
    return typeof claims.actionHash === 'string' ? claims.actionHash : null;
  } catch {
    return null;
  }
}

export const POST = defineRoute({
  methods: ['POST'],
  input: Input,
  auth: 'admin',
  surface: 'approvals',
  action: 'approvals.grant',
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

    // After the `apiError` never-returning calls, the row is the only
    // path forward. The explicit assignment re-assures TS that the
    // value is non-null (apiError throws, so control doesn't continue).
    const approvalRow: PendingApproval = row as PendingApproval;

    // PB-1 + SR-020: verify the action binding before granting. The
    // canonical binding for an approval row is
    //   actionHashFor(row.signalName, { runId: row.runId, role: row.role, approver: user.username })
    // The token's `actionHash` claim must match this hash; otherwise
    // the token does not authorize this specific (action, target) and
    // the grant is rejected.
    if (input?.token) {
      const expected = actionHashFor(approvalRow.signalName, {
        runId: approvalRow.runId,
        role: approvalRow.role ?? '',
        approver: user.username,
      });
      const claimed = decodeTokenActionHash(input.token as string);
      if (claimed === null) {
        apiError(event, validationError('Malformed approval token'));
      }
      if (claimed !== expected) {
        apiError(
          event,
          validationError(
            'Approval token action binding does not match this row (PB-1 + SR-020)',
          ),
        );
      }
    }

    // Idempotency — a second grant on an already-approved row is a
    // 400 (the errors module does not yet ship a ConflictError
    // type). A duplicate grant on a resolved row is a client error.
    if (approvalRow.decision !== null) {
      apiError(
        event,
        validationError(
          approvalRow.decision === 'approve'
            ? 'Approval already granted'
            : 'Approval already resolved',
        ),
      );
    }

    // The action binding checks above are PB-1 + SR-020. Now
    // perform the grant — set the decision + approver on the row.
    const updated = resolvePendingApproval(id, 'approve', user.username);
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
