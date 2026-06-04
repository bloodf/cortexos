/**
 * AuditLogList.test.ts — empty state, row rendering, header columns.
 */
import { describe, it, expect, afterEach } from 'vitest';
import type { ComponentProps } from 'svelte';
import { render, cleanup } from '../../../utils/test-render';
import AuditLogList from '../AuditLogList.svelte';
import { testMessages } from './messages';
import type { AuditEvent } from '$lib/server/entities';
import { asAuditEventId, asUserId } from '$lib/server/entities';

afterEach(cleanup);

function makeEvent(over: Partial<AuditEvent> = {}): AuditEvent {
	return {
		id: asAuditEventId('00000000-0000-4000-8000-000000000001'),
		actorUserId: asUserId('alice'),
		actorSessionId: null,
		actorIp: '127.0.0.1',
		actorUserAgent: 'test',
		surface: 'auth',
		action: 'auth.login',
		target: null,
		result: 'success',
		errorCode: null,
		requestId: 'req-1',
		prevHash: null,
		payloadHash: 'abc1234567890def',
		payload: { foo: 'bar' },
		createdAt: '2026-06-03T12:00:00.000Z',
		...over,
	};
}

describe('AuditLogList', () => {
	it('renders the empty state when events is empty', () => {
		const { container } = render(AuditLogList, {
			props: { events: [], messages: testMessages } as ComponentProps<typeof AuditLogList>,
		});
		// EmptyState primitive renders a status region.
		expect(container.querySelector('[role="status"]')).not.toBeNull();
		// Table is not rendered.
		expect(container.querySelector('table')).toBeNull();
	});

	it('renders the table when there are events', () => {
		const events = [makeEvent()];
		const { container } = render(AuditLogList, {
			props: { events, messages: testMessages } as ComponentProps<typeof AuditLogList>,
		});
		expect(container.querySelector('table')).not.toBeNull();
		expect(container.querySelectorAll('tbody tr').length).toBe(1);
	});

	it('renders one row per event', () => {
		const events = [
			makeEvent({ id: asAuditEventId('00000000-0000-4000-8000-000000000001') }),
			makeEvent({ id: asAuditEventId('00000000-0000-4000-8000-000000000002') }),
			makeEvent({ id: asAuditEventId('00000000-0000-4000-8000-000000000003') }),
		];
		const { container } = render(AuditLogList, {
			props: { events, messages: testMessages } as ComponentProps<typeof AuditLogList>,
		});
		expect(container.querySelectorAll('tbody tr').length).toBe(3);
	});

	it('renders the column headers in order', () => {
		const { container } = render(AuditLogList, {
			props: { events: [makeEvent()], messages: testMessages } as ComponentProps<typeof AuditLogList>,
		});
		const headers = Array.from(container.querySelectorAll('thead th')).map((th) => th.textContent?.trim());
		expect(headers).toEqual(['When', 'Surface / action', 'Actor', 'Target', 'Result', 'Payload hash']);
	});

	it('renders an anchor with href=/audit/<id> in each row', () => {
		const ev = makeEvent({ id: asAuditEventId('00000000-0000-4000-8000-000000000099') });
		const { container } = render(AuditLogList, {
			props: { events: [ev], messages: testMessages } as ComponentProps<typeof AuditLogList>,
		});
		const a = container.querySelector('a[href="/audit/00000000-0000-4000-8000-000000000099"]');
		expect(a).not.toBeNull();
	});

	it('truncates long payload hashes to 12 chars + ellipsis', () => {
		const ev = makeEvent({ payloadHash: 'a'.repeat(64) });
		const { container } = render(AuditLogList, {
			props: { events: [ev], messages: testMessages } as ComponentProps<typeof AuditLogList>,
		});
		const hashCell = container.querySelector('tbody tr td:last-child');
		expect(hashCell?.textContent?.trim()).toBe('aaaaaaaaaaaa…');
	});
});
