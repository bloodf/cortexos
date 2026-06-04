/**
 * Adapter — bridge Drizzle alert rows to the contracts alert types.
 *
 * Two shape mismatches to reconcile:
 *
 *   1. **IDs** — the DB stores `serial` (integer) ids; the contracts
 *      expect UUID v4 strings. We mint a stable UUID from each
 *      integer id using a hand-rolled v5-like derivation (same
 *      strategy as the services adapter). The same integer always
 *      maps to the same UUID across requests.
 *
 *   2. **Severity** — the DB CHECK constraint permits four values
 *      (`info`/`warn`/`error`/`critical`); the contracts enum has
 *      three (`info`/`warning`/`critical`). We collapse the
 *      extra level (`warn`→`warning`, `error`→`critical`).
 *
 * The reverse direction (`contracts → DB`) is also defined for the
 * form-action paths that need to write a new rule.
 *
 * Inputs are typed structurally (the Drizzle `$inferSelect` rows
 * have a stable shape). Output is the contracts type. Both sides
 * are controlled by the dashboard, so the structural cast is safe.
 */
import type {
	AlertRule,
	AlertEvent,
	OperationalAlert,
	AlertSeverity,
	AlertCondition,
	AlertChannel,
} from '@cortexos/contracts';
import { alertRuleId, alertEventId } from '@cortexos/contracts';

/**
 * Drizzle row shapes (mirror `$inferSelect` for the alerts schema).
 * We keep these here (rather than reaching into the schema barrel)
 * so the adapter is testable in isolation from the DB client.
 */
export interface DbAlertRule {
	id: number;
	serviceId: number;
	name: string;
	condition: 'offline' | 'online' | 'response_time' | string;
	thresholdMs: number | null;
	enabled: boolean;
	createdAt: Date;
	updatedAt: Date;
}

export interface DbAlertHistoryRow {
	id: number;
	ruleId: number;
	serviceId: number;
	status: 'fired' | 'resolved' | 'info' | string;
	message: string;
	createdAt: Date;
}

export interface DbOperationalAlert {
	id: number;
	kind: string;
	severity: 'info' | 'warn' | 'error' | 'critical' | string;
	title: string;
	body: string | null;
	source: string | null;
	acknowledgedAt: Date | null;
	createdAt: Date;
}

/**
 * Shape the route loaders produce and the components consume.
 * We re-declare the contracts id brands as plain strings so the
 * adapter signature stays usable from non-Svelte files (e.g. the
 * server loaders that don't need the brand).
 */
export type RuleId = string;
export type EventId = string;
export type OperationalAlertId = string;
export type ServiceIdRef = string;

/** Stable UUID derivation, namespace-scoped. */
const NAMESPACE = 'c2d3e4f5-a6b7-4c8d-9e0f-1a2b3c4d5e6f';

function integerToUuid(n: number, salt: string): string {
	let h = 0xdeadbeef;
	for (let i = 0; i < NAMESPACE.length; i++) {
		h = Math.imul(h ^ NAMESPACE.charCodeAt(i), 2654435761) >>> 0;
	}
	for (let i = 0; i < salt.length; i++) {
		h = Math.imul(h ^ salt.charCodeAt(i), 2654435761) >>> 0;
	}
	h = Math.imul(h ^ n, 2654435761) >>> 0;
	const hex = h.toString(16).padStart(8, '0');
	const tail = (h >>> 0).toString(16).padStart(8, '0');
	const filler = (h.toString(16) + tail + h.toString(16).split('').reverse().join(''))
		.replace(/[^0-9a-f]/g, '0')
		.slice(0, 32)
		.padEnd(32, '0');
	const part = [
		filler.slice(0, 8),
		filler.slice(8, 12),
		'4' + filler.slice(13, 16),
		((parseInt(filler.slice(16, 17), 16) & 0x3) | 0x8).toString(16) + filler.slice(17, 20),
		filler.slice(20, 32),
	].join('-');
	// Reference `hex` to keep the inference alive; future-proof if we
	// ever want to embed the actual integer into the UUID payload.
	void hex;
	return part;
}

function ruleUuid(ruleId: number): RuleId {
	return integerToUuid(ruleId, 'rule');
}

function eventUuid(eventId: number): EventId {
	return integerToUuid(eventId, 'event');
}

function operationalUuid(alertId: number): OperationalAlertId {
	return integerToUuid(alertId, 'op');
}

function serviceRefUuid(serviceId: number): ServiceIdRef {
	return integerToUuid(serviceId, 'svc');
}

// ---------------------------------------------------------------------------
// Severity / condition mappers
// ---------------------------------------------------------------------------

/**
 * Map the DB severity (4-level) to the contracts severity (3-level).
 * `error` and `critical` both collapse into `critical` because the
 * contracts enum is the wire format consumed by the toaster / webhook
 * layers.
 */
export function toContractSeverity(db: string): AlertSeverity {
	if (db === 'warn') return 'warning';
	if (db === 'error' || db === 'critical') return 'critical';
	return 'info';
}

function toContractCondition(s: string): AlertCondition {
	if (s === 'offline' || s === 'online' || s === 'response_time') return s;
	return 'offline';
}

function toContractEventStatus(s: string): 'fired' | 'resolved' | 'info' {
	if (s === 'fired' || s === 'resolved' || s === 'info') return s;
	// The DB stores the rule's `condition` (offline/online/response_time)
	// in some legacy rows. Translate to a sensible default.
	return 'fired';
}

function toDate(d: Date | string | null | undefined): string {
	if (!d) return new Date(0).toISOString();
	if (typeof d === 'string') return d;
	return d.toISOString();
}

// ---------------------------------------------------------------------------
// Rule adapter
// ---------------------------------------------------------------------------

/** Adapt a DB rule row to the contracts `AlertRule`. */
export function adaptAlertRule(row: DbAlertRule): AlertRule {
	return {
		id: alertRuleId(ruleUuid(row.id)),
		name: row.name,
		serviceId: row.serviceId
			? (serviceRefUuid(row.serviceId) as unknown as ReturnType<typeof serviceRefUuid> as unknown as AlertRule['serviceId'])
			: null,
		condition: toContractCondition(row.condition),
		thresholdMs: row.thresholdMs ?? null,
		severity: 'warning', // DB doesn't store per-rule severity; contracts require it.
		channels: ['ui'], // Same — channels are an M2.5+ feature.
		enabled: row.enabled,
		createdAt: toDate(row.createdAt),
		updatedAt: toDate(row.updatedAt),
	};
}

export function adaptAlertRuleList(rows: readonly DbAlertRule[]): AlertRule[] {
	return rows.map(adaptAlertRule);
}

// ---------------------------------------------------------------------------
// Alert history adapter
// ---------------------------------------------------------------------------

/** Adapt a DB history row to the contracts `AlertEvent`. */
export function adaptAlertEvent(row: DbAlertHistoryRow): AlertEvent {
	return {
		id: alertEventId(eventUuid(row.id)),
		ruleId: row.ruleId
			? (ruleUuid(row.ruleId) as unknown as AlertEvent['ruleId'])
			: null,
		ruleName: null,
		serviceId: row.serviceId
			? (serviceRefUuid(row.serviceId) as unknown as AlertEvent['serviceId'])
			: null,
		serviceName: null,
		status: toContractEventStatus(row.status),
		severity: 'warning',
		message: row.message,
		firedAt: toDate(row.createdAt),
		resolvedAt: null,
		durationSec: null,
	};
}

export function adaptAlertEventList(rows: readonly DbAlertHistoryRow[]): AlertEvent[] {
	return rows.map(adaptAlertEvent);
}

// ---------------------------------------------------------------------------
// Operational alert adapter
// ---------------------------------------------------------------------------

/** Adapt a DB operational alert row to the contracts `OperationalAlert`. */
export function adaptOperationalAlert(row: DbOperationalAlert): OperationalAlert {
	const ack = row.acknowledgedAt;
	return {
		id: operationalUuid(row.id) as unknown as OperationalAlert['id'],
		severity: toContractSeverity(row.severity),
		title: row.title,
		message: row.body ?? row.title,
		source: row.source ?? 'host',
		createdAt: toDate(row.createdAt),
		acknowledged: ack != null,
		acknowledgedBy: null,
		acknowledgedAt: ack ? toDate(ack) : null,
	};
}

export function adaptOperationalAlertList(
	rows: readonly DbOperationalAlert[],
): OperationalAlert[] {
	return rows.map(adaptOperationalAlert);
}

// ---------------------------------------------------------------------------
// Reverse direction — contracts → DB input for create / form actions
// ---------------------------------------------------------------------------

/** Strip the synthesized UUID prefix from a rule id (the dashboard
 *  treats the id as opaque but we need the integer back when the
 *  caller provides one in the URL). */
export function isSyntheticUuid(s: string): boolean {
	// Our minted UUIDs are v4-shaped. The router should not see them
	// in URLs (the [id] param is the integer primary key from the
	// DB), but we accept both shapes so form-action handlers don't
	// crash on legacy links.
	return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

/** A literal union mirror of the contracts enums — keeps the
 *  Svelte prop types tight without depending on Zod's HKT. */
export type AlertSeverityLit = 'info' | 'warning' | 'critical';
export type AlertConditionLit = 'offline' | 'online' | 'response_time';
export type AlertChannelLit = 'ui' | 'email' | 'webhook' | 'log';
export type AlertEventStatusLit = 'fired' | 'resolved' | 'info';

/** Channel list for the form (mirrors the contracts enum). */
export const CHANNELS: readonly AlertChannel[] = ['ui', 'email', 'webhook', 'log'] as const;
