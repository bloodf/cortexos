/**
 * /audit/[id] — single audit event detail with prev/next links and
 * a chain-verification badge.
 *
 * The chain verifier is `verifyAuditLogChain` from
 * src/lib/server/db/repos/audit.ts (Drizzle / TimescaleDB). We do not
 * reimplement the chain math.
 */
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { listAudit } from '$lib/server/audit';
import { db } from '$lib/server/db/client';
import { verifyAuditLogChain } from '$lib/server/db/repos/audit';
import { asAuditEventId } from '$lib/server/entities';

export const load: PageServerLoad = async ({ params }) => {
	const id = asAuditEventId(params.id);
	const all = listAudit();
	const idx = all.findIndex((e) => e.id === id);
	if (idx < 0) {
		throw error(404, `Audit event not found: ${params.id}`);
	}
	const event = all[idx]!;
	const prevId = idx > 0 ? all[idx - 1]!.id : null;
	const nextId = idx < all.length - 1 ? all[idx + 1]!.id : null;

	// Run the Drizzle chain verifier. On a real DB this hits the
	// `audit_log` hypertable; the M1 in-memory chain (listAudit above)
	// is the dev/test stand-in for the same data.
	const chainResult = await verifyAuditLogChain(db);

	return {
		event,
		prevId,
		nextId,
		chainLink: chainResult.valid
			? { ok: true as const, length: chainResult.count }
			: {
					ok: false as const,
					index: chainResult.brokenAt.id,
					reason: chainResult.brokenAt.reason,
				},
	};
};

