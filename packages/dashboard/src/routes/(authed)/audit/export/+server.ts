/**
 * /audit/export — CSV export of audit events.
 *
 * Per THREAT_MODEL §6, audit data may include IPs and sensitive payloads,
 * so this endpoint is admin-gated. SvelteKit 2.20 `+layout.server.ts` does
 * NOT cover `+server.ts` endpoints in the same route group — every
 * `+server.ts` that returns protected data must enforce its own auth gate
 * (see api/approvals/+server.ts and api/env-browser/+server.ts).
 *
 * Query parameters match the list page:
 *   ?actor, ?surface, ?action, ?result, ?since, ?until
 *
 * Response:
 *   200 text/csv; charset=utf-8
 *   Content-Disposition: attachment; filename="cortexos-audit-<UTC-timestamp>.csv"
 *   401 unauthenticated, 403 authenticated but non-admin
 *
 * CSV format:
 *   - Header row first
 *   - Fields are JSON-encoded for full fidelity (nested payload, hashes)
 *   - Newlines in payload are escaped via JSON.stringify, which inlines
 *     newlines as \n — so the row is single-line by construction
 */
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listAudit } from '$lib/server/audit';
import type { AuditEvent } from '$lib/server/entities';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:?\d{2})?)?$/;

const CSV_COLUMNS = [
	'id',
	'created_at',
	'surface',
	'action',
	'target',
	'result',
	'error_code',
	'actor_user_id',
	'actor_session_id',
	'actor_ip',
	'actor_user_agent',
	'request_id',
	'prev_hash',
	'payload_hash',
	'payload_json',
] as const;

function csvEscape(value: string): string {
	// RFC 4180: quote fields containing comma, double-quote, CR, or LF.
	// We JSON-encode complex values upstream, so the only escape we
	// need is for the rare case of a literal quote inside the value.
	if (/[",\r\n]/.test(value)) {
		return `"${value.replace(/"/g, '""')}"`;
	}
	return value;
}

function row(e: AuditEvent): string {
	return [
		e.id,
		e.createdAt,
		e.surface,
		e.action,
		e.target ?? '',
		e.result,
		e.errorCode ?? '',
		e.actorUserId ?? '',
		e.actorSessionId ?? '',
		e.actorIp ?? '',
		e.actorUserAgent ?? '',
		e.requestId,
		e.prevHash ?? '',
		e.payloadHash,
		JSON.stringify(e.payload),
	]
		.map(csvEscape)
		.join(',');
}

function buildFilename(): string {
	// UTC timestamp; filesystem-safe (no colons).
	const ts = new Date().toISOString().replace(/[:.]/g, '-');
	return `cortexos-audit-${ts}.csv`;
}

export const GET: RequestHandler = async ({ url, locals }) => {
	// CRITICAL: explicit admin gate. The (authed)/audit +layout.server.ts
	// does NOT protect +server.ts endpoints in SvelteKit 2.20. We check
	// `locals.user` (populated by hooks.server.ts on session resolution)
	// and call SvelteKit's `error()` directly so the framework returns
	// the right HTTP status.
	const user = locals.user;
	if (!user) {
		throw error(401, 'Authentication required');
	}
	if (!user.isAdmin) {
		throw error(403, 'Admin role required');
	}

	const actor = url.searchParams.get('actor')?.trim() ?? '';
	const surface = url.searchParams.get('surface')?.trim() ?? '';
	const action = url.searchParams.get('action')?.trim() ?? '';
	const resultParam = url.searchParams.get('result')?.trim() ?? '';
	const sinceParam = url.searchParams.get('since')?.trim() ?? '';
	const untilParam = url.searchParams.get('until')?.trim() ?? '';

	if (sinceParam && !ISO_DATE.test(sinceParam)) {
		throw error(400, 'Invalid `since` — expected ISO 8601');
	}
	if (untilParam && !ISO_DATE.test(untilParam)) {
		throw error(400, 'Invalid `until` — expected ISO 8601');
	}

	const result: 'success' | 'failure' | 'denied' | 'error' | null =
		resultParam === 'success' ||
		resultParam === 'failure' ||
		resultParam === 'denied' ||
		resultParam === 'error'
			? resultParam
			: null;

	const since = sinceParam ? new Date(sinceParam).toISOString() : null;
	const until = untilParam ? new Date(untilParam).toISOString() : null;

	let rows: AuditEvent[] = listAudit().slice().reverse(); // most recent first
	if (actor) rows = rows.filter((e) => (e.actorUserId ?? '').includes(actor));
	if (surface) rows = rows.filter((e) => e.surface === surface);
	if (action) rows = rows.filter((e) => e.action === action);
	if (result) rows = rows.filter((e) => e.result === result);
	if (since) rows = rows.filter((e) => e.createdAt >= since);
	if (until) rows = rows.filter((e) => e.createdAt <= until);

	const body = [CSV_COLUMNS.join(','), ...rows.map(row)].join('\r\n') + '\r\n';

	return new Response(body, {
		status: 200,
		headers: {
			'content-type': 'text/csv; charset=utf-8',
			'content-disposition': `attachment; filename="${buildFilename()}"`,
			'cache-control': 'no-store',
		},
	});
};
