/**
 * adapter.test.ts — verifies the Drizzle→contracts shape bridge.
 *
 * The adapter is the single point where the DB rows (integer ids,
 * 4-level severity) become the contracts types (UUID ids, 3-level
 * severity) that the components consume. Drift here is a contract
 * bug; these tests pin the mapping.
 */
import { describe, it, expect } from 'vitest';
import {
	adaptAlertRule,
	adaptAlertRuleList,
	adaptAlertEvent,
	adaptAlertEventList,
	adaptOperationalAlert,
	adaptOperationalAlertList,
	toContractSeverity,
	CHANNELS,
} from '../adapter';

describe('adapter — toContractSeverity', () => {
	it('maps DB "info" to contracts "info"', () => {
		expect(toContractSeverity('info')).toBe('info');
	});

	it('maps DB "warn" to contracts "warning"', () => {
		expect(toContractSeverity('warn')).toBe('warning');
	});

	it('maps DB "error" to contracts "critical"', () => {
		expect(toContractSeverity('error')).toBe('critical');
	});

	it('maps DB "critical" to contracts "critical"', () => {
		expect(toContractSeverity('critical')).toBe('critical');
	});

	it('falls back to "info" for unknown values', () => {
		expect(toContractSeverity('whatever')).toBe('info');
	});
});

describe('adapter — adaptAlertRule', () => {
	it('mints a UUID v4 from the integer rule id', () => {
		const r = adaptAlertRule({
			id: 1,
			serviceId: 1,
			name: 'n',
			condition: 'offline',
			thresholdMs: null,
			enabled: true,
			createdAt: new Date('2026-01-01T00:00:00Z'),
			updatedAt: new Date('2026-01-01T00:00:00Z'),
		});
		expect(r.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
	});

	it('maps condition + threshold faithfully', () => {
		const r = adaptAlertRule({
			id: 2,
			serviceId: 7,
			name: 'rt',
			condition: 'response_time',
			thresholdMs: 500,
			enabled: false,
			createdAt: new Date(),
			updatedAt: new Date(),
		});
		expect(r.condition).toBe('response_time');
		expect(r.thresholdMs).toBe(500);
		expect(r.enabled).toBe(false);
	});

	it('maps a list of rules', () => {
		const list = adaptAlertRuleList([
			{
				id: 3,
				serviceId: 1,
				name: 'a',
				condition: 'online',
				thresholdMs: null,
				enabled: true,
				createdAt: new Date(),
				updatedAt: new Date(),
			},
		]);
		expect(list).toHaveLength(1);
		expect(list[0]?.condition).toBe('online');
	});
});

describe('adapter — adaptAlertEvent', () => {
	it('mints a UUID v4 from the integer event id', () => {
		const e = adaptAlertEvent({
			id: 11,
			ruleId: 1,
			serviceId: 1,
			status: 'fired',
			message: 'm',
			createdAt: new Date('2026-01-01T00:00:00Z'),
		});
		expect(e.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
		expect(e.status).toBe('fired');
		expect(e.message).toBe('m');
	});

	it('defaults unknown status to "fired"', () => {
		const e = adaptAlertEvent({
			id: 12,
			ruleId: 1,
			serviceId: 1,
			status: 'offline', // legacy raw value
			message: 'm',
			createdAt: new Date(),
		});
		expect(e.status).toBe('fired');
	});

	it('preserves "resolved" and "info" verbatim', () => {
		const r = adaptAlertEvent({
			id: 13,
			ruleId: 1,
			serviceId: 1,
			status: 'resolved',
			message: 'm',
			createdAt: new Date(),
		});
		expect(r.status).toBe('resolved');
		const i = adaptAlertEvent({
			id: 14,
			ruleId: 1,
			serviceId: 1,
			status: 'info',
			message: 'm',
			createdAt: new Date(),
		});
		expect(i.status).toBe('info');
	});

	it('maps a list of events', () => {
		const list = adaptAlertEventList([
			{
				id: 15,
				ruleId: 1,
				serviceId: 1,
				status: 'fired',
				message: 'm',
				createdAt: new Date(),
			},
		]);
		expect(list).toHaveLength(1);
	});
});

describe('adapter — adaptOperationalAlert', () => {
	it('maps an unacknowledged alert', () => {
		const a = adaptOperationalAlert({
			id: 21,
			kind: 'host',
			severity: 'warn',
			title: 't',
			body: 'b',
			source: 'src',
			acknowledgedAt: null,
			createdAt: new Date('2026-01-01T00:00:00Z'),
		});
		expect(a.severity).toBe('warning'); // warn -> warning
		expect(a.acknowledged).toBe(false);
		expect(a.acknowledgedAt).toBeNull();
	});

	it('maps an acknowledged alert', () => {
		const a = adaptOperationalAlert({
			id: 22,
			kind: 'host',
			severity: 'critical',
			title: 't',
			body: 'b',
			source: 'src',
			acknowledgedAt: new Date('2026-01-01T00:05:00Z'),
			createdAt: new Date('2026-01-01T00:00:00Z'),
		});
		expect(a.acknowledged).toBe(true);
		expect(a.acknowledgedAt).toBe('2026-01-01T00:05:00.000Z');
	});

	it('falls back to the title when body is null', () => {
		const a = adaptOperationalAlert({
			id: 23,
			kind: 'host',
			severity: 'info',
			title: 'just a title',
			body: null,
			source: 'src',
			acknowledgedAt: null,
			createdAt: new Date(),
		});
		expect(a.message).toBe('just a title');
	});

	it('maps a list of operational alerts', () => {
		const list = adaptOperationalAlertList([
			{
				id: 24,
				kind: 'host',
				severity: 'info',
				title: 't',
				body: 'b',
				source: 's',
				acknowledgedAt: null,
				createdAt: new Date(),
			},
		]);
		expect(list).toHaveLength(1);
	});
});

describe('adapter — CHANNELS', () => {
	it('exposes the contracts channel set', () => {
		expect(CHANNELS).toEqual(['ui', 'email', 'webhook', 'log']);
	});
});
