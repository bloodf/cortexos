/**
 * api-env-browser-extra.test.ts — coverage of the remaining branches
 * in /api/env-browser.
 *
 * The base test (`api-env-browser.test.ts`) only asserts the
 * default GET response shape. This file drives the 5 uncovered
 * branches:
 *
 *   - L58  maskValue: secret key with value.length <= 4 → '••••'
 *   - L59  maskValue: secret key with value.length > 4  → tail 4
 *   - L63  maskValue: entropy fallback (long base64-ish value)
 *   - L93  notFoundError when path is in allowlist but file not registered
 *
 * SECURITY INVARIANT (THREAT_MODEL §1.2 surface 8): without a live
 * PAM-verified reveal grant, the response MUST NOT carry cleartext —
 * `value` equals `masked` for every secret. Cleartext is only returned
 * once the session holds a reveal grant (see the "reveal grant" block).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { GET } from '../+server';
import { __registerEnvFile } from '../+server';
import { makeFakeEvent, makeFakeUser, makeFakeLocals, makeFakeSession } from '$lib/server/test-utils';
import { resetAudit } from '$lib/server/audit';
import { _resetAllBuckets } from '$lib/server/rate-limit';
import { grantReveal, _resetRevealGrants } from '$lib/server/env-reveal';

const adminUser = makeFakeUser({
	is_admin: true,
	isAdmin: true,
	groupMemberships: [{ name: 'cortexos-admin', isAdmin: true, description: 'admin' }],
});

/** GET with a fresh (locked) session — no reveal grant. */
async function call(path: string) {
	const url = `http://localhost/api/env-browser?path=${encodeURIComponent(path)}`;
	const event = makeFakeEvent({
		method: 'GET',
		url,
		locals: makeFakeLocals(adminUser, makeFakeSession(adminUser)),
	});
	return (GET as unknown as (e: unknown) => Promise<Response>)(event);
}

/** GET with a session that already holds a reveal grant. */
async function callRevealed(path: string) {
	const session = makeFakeSession(adminUser);
	grantReveal(session.id);
	const url = `http://localhost/api/env-browser?path=${encodeURIComponent(path)}`;
	const event = makeFakeEvent({
		method: 'GET',
		url,
		locals: makeFakeLocals(adminUser, session),
	});
	return (GET as unknown as (e: unknown) => Promise<Response>)(event);
}

beforeEach(() => {
	resetAudit();
	_resetAllBuckets();
	_resetRevealGrants();
});

describe('/api/env-browser — maskValue branches', () => {
	it('masks short secret values to bullet characters', async () => {
		// SECRET_KEY_RE matches "pwd" → maskValue uses the secret branch.
		// value.length is exactly 4 → the `value.length <= 4` branch
		// returns the bare '••••' (no tail).
		__registerEnvFile('/opt/cortexos/.secrets/short.env', [
			{ key: 'DB_PWD', value: '1234' },
		]);
		const res = await call('/opt/cortexos/.secrets/short.env');
		expect(res.status).toBe(200);
		const body = await res.json();
		// Locked session: value must be the mask, never the cleartext.
		expect(body.revealed).toBe(false);
		expect(body.entries[0].masked).toBe('••••');
		expect(body.entries[0].value).toBe('••••');
	});

	it('masks long secret values to bullets + last 4 chars', async () => {
		// SECRET_KEY_RE matches "secret" → secret branch with value.length > 4
		// → '••••••••' + last 4 chars of value.
		__registerEnvFile('/opt/cortexos/.secrets/long.env', [
			{ key: 'CLIENT_SECRET', value: 'abcdefgh-secret-1234' },
		]);
		const res = await call('/opt/cortexos/.secrets/long.env');
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.revealed).toBe(false);
		expect(body.entries[0].masked).toBe('••••••••1234');
		expect(body.entries[0].value).toBe('••••••••1234');
	});

	it('masks high-entropy values even when key is non-secret', async () => {
		// key = "NON_SECRET_KEY" — no secret-pattern match.
		// value is 50 chars of base64-ish content → entropy fallback
		// returns '••••••••' + last 4.
		const longValue = 'A'.repeat(46) + 'abcd';
		__registerEnvFile('/opt/cortexos/.secrets/entropy.env', [
			{ key: 'NON_SECRET_KEY', value: longValue },
		]);
		const res = await call('/opt/cortexos/.secrets/entropy.env');
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.revealed).toBe(false);
		expect(body.entries[0].masked).toBe('••••••••abcd');
		expect(body.entries[0].value).toBe('••••••••abcd');
	});

	it('passes through non-secret short values unchanged', async () => {
		// Sanity check: confirms the `return value;` final fallback.
		__registerEnvFile('/opt/cortexos/.secrets/plain.env', [
			{ key: 'PLAIN_KEY', value: 'visible' },
		]);
		const res = await call('/opt/cortexos/.secrets/plain.env');
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.entries[0].value).toBe('visible');
		expect(body.entries[0].masked).toBe('visible');
	});
});

describe('/api/env-browser — reveal grant', () => {
	it('returns cleartext only when the session holds a reveal grant', async () => {
		__registerEnvFile('/opt/cortexos/.secrets/reveal.env', [
			{ key: 'CLIENT_SECRET', value: 'abcdefgh-secret-1234' },
		]);
		const res = await callRevealed('/opt/cortexos/.secrets/reveal.env');
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.revealed).toBe(true);
		// With a grant, the raw value is returned; the mask is still present.
		expect(body.entries[0].value).toBe('abcdefgh-secret-1234');
		expect(body.entries[0].masked).toBe('••••••••1234');
	});

	it('does not leak cleartext to a different (un-granted) session', async () => {
		__registerEnvFile('/opt/cortexos/.secrets/reveal2.env', [
			{ key: 'CLIENT_SECRET', value: 'abcdefgh-secret-1234' },
		]);
		// callRevealed grants a one-off random session; `call` uses a
		// different fresh session, which must remain locked.
		await callRevealed('/opt/cortexos/.secrets/reveal2.env');
		const res = await call('/opt/cortexos/.secrets/reveal2.env');
		const body = await res.json();
		expect(body.revealed).toBe(false);
		expect(body.entries[0].value).toBe('••••••••1234');
	});
});

describe('/api/env-browser — not_found path', () => {
	it('returns 404 when the path is allowed but the file is not registered', async () => {
		// L93: the allowlist prefix check passes, but envFiles.get(path)
		// returns undefined → notFoundError.
		const res = await call('/opt/cortexos/.secrets/missing.env');
		expect(res.status).toBe(404);
		const body = await res.json();
		expect(body.message).toMatch(/Env file not found/);
		expect(body.code).toBe('not_found');
	});
});
