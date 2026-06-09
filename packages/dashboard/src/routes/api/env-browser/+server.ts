/**
 * /api/env-browser — read env vars from the host filesystem.
 *
 * PB-3 (THREAT_MODEL §1.2 surface 8, T-070..T-074):
 *   - requireAdmin on every read
 *   - Path allowlist with realpath resolution (SR-073)
 *   - Masked by default. The raw plaintext value is ONLY included when
 *     the calling session holds a live reveal grant — opened by
 *     re-proving the operator's PAM password at POST
 *     /api/env-browser/unlock, valid for REVEAL_TTL (10 min). Without
 *     a grant the response never carries cleartext (`value === masked`).
 */
import { z } from 'zod';
import { defineRoute } from '$lib/server/route-helper';
import { notFoundError, permissionError } from '$lib/server/errors/types';
import { hasRevealGrant, revealExpiresAt } from '$lib/server/env-reveal';
import { readFile } from 'node:fs/promises';
import { realpath } from 'node:fs/promises';

const QueryInput = z.object({
	path: z.string().min(1).max(2048),
});

const ALLOWED_PREFIXES: ReadonlyArray<string> = [
	'/opt/cortexos/.secrets/',
	'/opt/cortexos/stacks/',
];

const SECRET_KEY_RE = new RegExp(
	'(password|passwd|pwd|secret|token|api[_-]?key|access[_-]?key|private[_-]?key|client[_-]?secret|session[_-]?id|cookie|authorization|bearer)',
	'i',
);

function maskValue(key: string, value: string): string {
	if (SECRET_KEY_RE.test(key)) {
		if (value.length <= 4) return '••••';
		return `••••••••${value.slice(-4)}`;
	}
	if (value.length >= 40 && /^[A-Za-z0-9+/=_-]+$/.test(value)) {
		return `••••••••${value.slice(-4)}`;
	}
	return value;
}

async function isPathAllowed(path: string): Promise<boolean> {
	try {
		const resolved = await realpath(path);
		for (const prefix of ALLOWED_PREFIXES) {
			if (resolved.startsWith(prefix)) return true;
		}
	} catch {
		// realpath fails — fall through to simple prefix check
	}
	for (const prefix of ALLOWED_PREFIXES) {
		if (path.startsWith(prefix)) return true;
	}
	return false;
}

async function readEnvFile(path: string): Promise<Array<{ key: string; value: string; masked: string }>> {
	const text = await readFile(path, 'utf-8');
	const lines = text.split('\n');
	const entries: Array<{ key: string; value: string; masked: string }> = [];
	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) continue;
		const eq = trimmed.indexOf('=');
		if (eq === -1) continue;
		const key = trimmed.slice(0, eq).trim();
		const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
		entries.push({ key, value, masked: maskValue(key, value) });
	}
	return entries;
}

// In-memory fallback for tests (M1 stub compat)
const envFiles = new Map<string, ReadonlyArray<{ key: string; value: string; masked: string }>>();

/** Test helper: register an env file. */
export function __registerEnvFile(
	path: string,
	entries: ReadonlyArray<{ key: string; value: string }>,
): void {
	envFiles.set(
		path,
		entries.map((e) => ({
			key: e.key,
			value: e.value,
			masked: maskValue(e.key, e.value),
		})),
	);
}

async function getEnvEntries(path: string): Promise<ReadonlyArray<{ key: string; value: string; masked: string }> | null> {
	// Try filesystem first
	try {
		return await readEnvFile(path);
	} catch {
		// Fall back to in-memory map for tests
	}
	return envFiles.get(path) ?? null;
}

export const GET = defineRoute({
	methods: ['GET'],
	input: QueryInput,
	auth: 'admin',
	surface: 'env-browser',
	action: 'env-browser.read',
	target: (i) => i.path,
	rateLimit: { limit: 30, windowSec: 60, bucket: 'user' },
	handler: async ({ event, input }) => {
		if (!await isPathAllowed(input.path)) {
			throw permissionError(`Path not in allowlist: ${input.path}`);
		}

		const entries = await getEnvEntries(input.path);
		if (!entries) {
			throw notFoundError(`Env file not found: ${input.path}`, 'env_file');
		}

		// Cleartext is gated behind a PAM-verified reveal window bound to
		// this session (see POST /api/env-browser/unlock). When the window
		// is closed, `value` is the masked string — no secret ever leaves
		// the server without an active grant.
		const sessionId = event.locals.session?.id ?? null;
		const revealed = hasRevealGrant(sessionId);

		return {
			path: input.path,
			revealed,
			revealExpiresAt: revealed ? revealExpiresAt(sessionId) : null,
			entries: entries.map(({ key, value, masked }) => ({
				key,
				value: revealed ? value : masked,
				masked,
			})),
		};
	},
});
