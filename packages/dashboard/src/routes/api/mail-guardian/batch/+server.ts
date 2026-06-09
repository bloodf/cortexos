/**
 * POST /api/mail-guardian/batch — batch approve or flag mail reviews.
 *
 * Body: { ids: number[], action: 'approve' | 'flag' }
 */
import { z } from 'zod';
import { defineRoute } from '$lib/server/route-helper';
import { getDb } from '$lib/server/db/client';
import {
	batchUpdateMailReviewDecisions,
	createMailGuardianAction,
} from '$lib/server/db/repos/mail_guardian';

const Input = z.object({
	ids: z.array(z.number().int().positive()).max(100),
	action: z.enum(['approve', 'flag']),
});

export const POST = defineRoute({
	methods: ['POST'],
	input: Input,
	auth: 'admin',
	surface: 'mail-guardian',
	action: 'mail-guardian.batch',
	target: (i) => `${i.action}:${i.ids.length}`,
	rateLimit: { limit: 30, windowSec: 60, bucket: 'user' },
	handler: async ({ input }) => {
		const db = getDb();
		const decision = input.action === 'approve' ? 'keep' : 'spam';

		const updated = await batchUpdateMailReviewDecisions(db, input.ids, decision, 'dashboard');

		for (const id of input.ids) {
			await createMailGuardianAction(db, {
				reviewId: id,
				decision,
				approver: 'dashboard',
				status: 'pending',
			});
		}

		return { updated, action: input.action };
	},
});
