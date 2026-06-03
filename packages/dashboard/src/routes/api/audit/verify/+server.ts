/**
 * /api/audit/verify — walk the audit chain and report integrity.
 *
 * THREAT_MODEL SR-094: nightly chain walk alerts on first mismatch; no
 * auto-fix. M1 returns the in-memory verifier result; M3 runs against
 * the real audit_log hypertable.
 */

import { defineRoute } from '$lib/server/route-helper';
import { verifyAuditChain } from '$lib/server/audit';

export const GET = defineRoute({
  methods: ['GET'],
  auth: 'admin',
  surface: 'audit',
  action: 'audit.verify',
  rateLimit: { limit: 5, windowSec: 60, bucket: 'user' },
  handler: async () => {
    const result = verifyAuditChain();
    return { result };
  },
});
