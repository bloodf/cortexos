/**
 * /audit/verify — full chain verification report.
 *
 * Runs `verifyAuditLogChain` from src/lib/server/db/repos/audit.ts
 * (the Drizzle-backed TimescaleDB chain verifier, matching
 * `@cortexos/audit#verifyChain`). We do NOT reimplement the chain
 * math here — the repo function walks the `audit_log` table in
 * `occurred_at` order, recomputes each link, and reports the first
 * failure (or a success summary).
 *
 * The page is admin-gated by the route group's +layout.server.ts
 * (THREAT_MODEL §6).
 */
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db/client';
import { verifyAuditLogChain, type VerifyChainResult } from '$lib/server/db/repos/audit';
import type { AuditVerifyResult } from '$lib/server/audit';

export const load: PageServerLoad = async () => {
	const raw: VerifyChainResult = await verifyAuditLogChain(db);
	// Map the Drizzle result shape to the M1 AuditVerifyResult shape
	// the ChainVerifyReport component consumes. (M1: { ok, length, index, reason }.
	// Drizzle: { valid, count, firstId/lastId, brokenAt { id, occurredAt, reason } }.)
	const result: AuditVerifyResult = raw.valid
		? { ok: true, length: raw.count }
		: { ok: false, index: raw.brokenAt.id, reason: raw.brokenAt.reason };
	const length = raw.count;
	return { result, length, ranAt: new Date().toISOString() };
};
