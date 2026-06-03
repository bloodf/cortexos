/**
 * /audit/verify — full chain verification report.
 *
 * Runs `verifyAuditChain` from src/lib/server/audit and surfaces the
 * result. The chain math itself lives in the audit module — this
 * loader just calls it and returns the result.
 *
 * The page is admin-gated by the route group's +layout.server.ts.
 */
import type { PageServerLoad } from './$types';
import { listAudit, verifyAuditChain } from '$lib/server/audit';

export const load: PageServerLoad = () => {
	const result = verifyAuditChain();
	const length = result.ok ? result.length : listAudit().length;
	return { result, length, ranAt: new Date().toISOString() };
};
