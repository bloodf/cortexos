/**
 * /api/mail-guardian/accounts — list and create monitored IMAP accounts.
 *
 *   GET  -> list all accounts (passwords redacted)
 *   POST -> create a new account (password stored base64-encoded)
 *
 * Admin-gated. Backs the account-management section of /mail-guardian.
 */
import { z } from 'zod';
import { defineRoute } from '$lib/server/route-helper';
import { getDb } from '$lib/server/db/client';
import {
	listMailAccounts,
	getMailAccountBySlug,
	createMailAccount,
} from '$lib/server/db/repos/mail_guardian';
import { validationError } from '$lib/server/errors/types';

// Not exported: SvelteKit +server.ts files may only export HTTP method
// handlers (or `_`-prefixed symbols). Kept module-local.
const accountInputSchema = z.object({
	slug: z
		.string()
		.trim()
		.min(1)
		.max(64)
		.regex(/^[a-z0-9][a-z0-9-]*$/, 'slug must be lowercase alphanumeric with dashes'),
	address: z.string().trim().email().max(255),
	host: z.string().trim().min(1).max(255),
	port: z.number().int().min(1).max(65535).default(993),
	secure: z.boolean().default(true),
	username: z.string().trim().min(1).max(255),
	password: z.string().min(1).max(1024),
	inbox: z.string().trim().min(1).max(255).default('INBOX'),
	trashMailbox: z.string().trim().max(255).optional().nullable(),
	reviewMailbox: z.string().trim().min(1).max(255).default('INBOX.Cortex Mail Guardian Review'),
	enabled: z.boolean().default(true),
});

export const GET = defineRoute({
	methods: ['GET'],
	auth: 'admin',
	surface: 'mail-guardian',
	action: 'mail-guardian.accounts.list',
	handler: async () => {
		const db = getDb();
		const accounts = await listMailAccounts(db);
		return { accounts };
	},
});

export const POST = defineRoute({
	methods: ['POST'],
	input: accountInputSchema,
	auth: 'admin',
	surface: 'mail-guardian',
	action: 'mail-guardian.accounts.create',
	target: (i) => i.slug,
	rateLimit: { limit: 30, windowSec: 60, bucket: 'user' },
	handler: async ({ input }) => {
		const db = getDb();
		const existing = await getMailAccountBySlug(db, input.slug);
		if (existing) {
			throw validationError(`An account with slug "${input.slug}" already exists`, [
				{ field: 'slug', message: 'must be unique' },
			]);
		}
		const account = await createMailAccount(db, input);
		return { account };
	},
});
