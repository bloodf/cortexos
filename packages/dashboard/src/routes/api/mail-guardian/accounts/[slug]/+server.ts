/**
 * /api/mail-guardian/accounts/[slug] — update, toggle, or delete an account.
 *
 *   PUT    -> update an account (password optional; omit to keep the stored one)
 *   PATCH  -> enable/disable an account ({ enabled: boolean })
 *   DELETE -> remove an account
 *
 * Admin-gated.
 */
import { z } from 'zod';
import { defineRoute } from '$lib/server/route-helper';
import type { RequestEvent } from '$lib/server/types';
import { getDb } from '$lib/server/db/client';
import {
	updateMailAccount,
	setMailAccountEnabled,
	deleteMailAccount,
} from '$lib/server/db/repos/mail_guardian';
import { notFoundError } from '$lib/server/errors/types';

function slugParam(event: RequestEvent): string {
	return (event as unknown as { params: Record<string, string> }).params?.slug ?? '';
}

const updateSchema = z.object({
	address: z.string().trim().email().max(255),
	host: z.string().trim().min(1).max(255),
	port: z.number().int().min(1).max(65535).default(993),
	secure: z.boolean().default(true),
	username: z.string().trim().min(1).max(255),
	password: z.string().min(1).max(1024).optional(),
	inbox: z.string().trim().min(1).max(255).default('INBOX'),
	trashMailbox: z.string().trim().max(255).optional().nullable(),
	reviewMailbox: z.string().trim().min(1).max(255).default('INBOX.Cortex Mail Guardian Review'),
	enabled: z.boolean().default(true),
});

const patchSchema = z.object({ enabled: z.boolean() });

export const PUT = defineRoute({
	methods: ['PUT'],
	input: updateSchema,
	auth: 'admin',
	surface: 'mail-guardian',
	action: 'mail-guardian.accounts.update',
	target: (_i, event) => slugParam(event),
	rateLimit: { limit: 30, windowSec: 60, bucket: 'user' },
	handler: async ({ input, event }) => {
		const slug = slugParam(event);
		const db = getDb();
		const account = await updateMailAccount(db, slug, { ...input, slug });
		if (!account) throw notFoundError(`Account "${slug}" not found`, 'mail_account');
		return { account };
	},
});

export const PATCH = defineRoute({
	methods: ['PATCH'],
	input: patchSchema,
	auth: 'admin',
	surface: 'mail-guardian',
	action: 'mail-guardian.accounts.toggle',
	target: (_i, event) => slugParam(event),
	rateLimit: { limit: 60, windowSec: 60, bucket: 'user' },
	handler: async ({ input, event }) => {
		const slug = slugParam(event);
		const db = getDb();
		const account = await setMailAccountEnabled(db, slug, input.enabled);
		if (!account) throw notFoundError(`Account "${slug}" not found`, 'mail_account');
		return { account };
	},
});

export const DELETE = defineRoute({
	methods: ['DELETE'],
	auth: 'admin',
	surface: 'mail-guardian',
	action: 'mail-guardian.accounts.delete',
	target: (_i, event) => slugParam(event),
	rateLimit: { limit: 30, windowSec: 60, bucket: 'user' },
	handler: async ({ event }) => {
		const slug = slugParam(event);
		const db = getDb();
		const deleted = await deleteMailAccount(db, slug);
		if (!deleted) throw notFoundError(`Account "${slug}" not found`, 'mail_account');
		return { deleted: true, slug };
	},
});
