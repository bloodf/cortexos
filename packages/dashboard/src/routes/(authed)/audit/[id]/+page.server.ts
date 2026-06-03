/**
 * /audit/[id] — single audit event detail with prev/next links and
 * a chain-verification badge.
 *
 * The chain verifier is `verifyAuditChain` from src/lib/server/audit
 * (the M1 in-memory chain verifier; M3 swaps to `verifyAuditLogChain`
 * from the Drizzle repo). We do not reimplement the chain math.
 */
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { listAudit, verifyAuditChain } from '$lib/server/audit';
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

	// Run the chain verifier (cheap on the in-memory store) and surface
	// the result alongside the event. M3 will swap this to
	// `verifyAuditLogChain` from the Drizzle repo.
	const chainResult = verifyAuditChain();

	return {
		event,
		prevId,
		nextId,
		chainLink: chainResult.ok
			? { ok: true as const, length: chainResult.length }
			: {
					ok: false as const,
					index: chainResult.index,
					reason: chainResult.reason,
				},
	};
};
