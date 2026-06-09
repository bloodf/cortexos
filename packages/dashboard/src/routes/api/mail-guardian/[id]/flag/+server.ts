/**
 * POST /api/mail-guardian/[id]/flag — flag a mail review as spam.
 *
 * Sets owner_decision='spam', resolved_at=NOW(), approver='dashboard',
 * and inserts a pending mail_guardian_actions row.
 */
import { z } from 'zod';
import { defineRoute } from '$lib/server/route-helper';
import { getDb } from '$lib/server/db/client';
import {
	getMailReviewById,
	updateMailReviewDecision,
	createMailGuardianAction,
} from '$lib/server/db/repos/mail_guardian';
import { notFoundError } from '$lib/server/errors/types';

const Input = z.object({}).optional();

export const POST = defineRoute({
	methods: ['POST'],
	input: Input,
	auth: 'admin',
	surface: 'mail-guardian',
	action: 'mail-guardian.flag',
	target: (_i, event) => {
		const id = (event as unknown as { params: Record<string, string> }).params?.id ?? '';
		return id;
	},
	rateLimit: { limit: 60, windowSec: 60, bucket: 'user' },
	handler: async ({ event }) => {
		const idParam = (event as unknown as { params: Record<string, string> }).params?.id ?? '';
		const id = Number(idParam);
		if (!Number.isFinite(id)) {
			return { error: 'Invalid review id' };
		}

		const db = getDb();
		const review = await getMailReviewById(db, id);
		if (!review) {
			throw notFoundError(`Review ${id} not found`, 'mail_review');
		}

		const updated = await updateMailReviewDecision(db, id, 'spam', 'dashboard');
		if (!updated) {
			throw notFoundError(`Review ${id} not found`, 'mail_review');
		}

		await createMailGuardianAction(db, {
			reviewId: id,
			decision: 'spam',
			approver: 'dashboard',
			status: 'pending',
		});

		return {
			id: updated.id,
			ownerDecision: updated.ownerDecision,
			resolvedAt: updated.resolvedAt,
			approver: updated.approver,
		};
	},
});
