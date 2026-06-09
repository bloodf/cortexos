/**
 * /mail-guardian — email security review queue.
 *
 * Lists mail reviews from the cortex-mail-guardian tables.
 */
import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db/client';
import {
	listMailReviews,
	getMailStats,
	listPendingActions,
	listMailAccounts,
} from '$lib/server/db/repos/mail_guardian';

export const load: PageServerLoad = async ({ url }) => {
	const accountQ = url.searchParams.get('account') ?? '';
	const pendingOnly = url.searchParams.get('pending') === '1';

	const db = getDb();
	const { rows, total } = await listMailReviews(db, {
		accountSlug: accountQ || undefined,
		pendingOnly,
		pageSize: 500,
	});
	const stats = await getMailStats(db);
	const pendingActions = await listPendingActions(db, 50);
	const accounts = await listMailAccounts(db);

	return {
		reviews: rows,
		total,
		stats,
		pendingActions,
		accounts,
		initialAccount: accountQ,
		initialPending: pendingOnly,
	};
};
