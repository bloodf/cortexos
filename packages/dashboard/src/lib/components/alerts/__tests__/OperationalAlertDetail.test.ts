/**
 * OperationalAlertDetail.test.ts — verifies the detail view shows
 * the alert metadata and the ack form when the user can ack and
 * the alert is unacknowledged.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '../../../utils/test-render';
import OperationalAlertDetail from '../OperationalAlertDetail.svelte';
import { testMessages } from './messages';
import type { OperationalAlert } from '@cortexos/contracts';

function makeAlert(overrides: Partial<OperationalAlert> = {}): OperationalAlert {
	return {
		id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' as OperationalAlert['id'],
		severity: 'critical',
		title: 'Disk filling up',
		message: '/var is at 95% capacity',
		source: 'disk-monitor',
		createdAt: '2026-01-01T00:00:00.000Z',
		acknowledged: false,
		acknowledgedBy: null,
		acknowledgedAt: null,
		...overrides,
	};
}

describe('OperationalAlertDetail', () => {
	afterEach(cleanup);

	it('renders the alert body and source', () => {
		const { container } = render(OperationalAlertDetail, {
			props: { alert: makeAlert(), messages: testMessages, canAck: true },
		});
		expect(
			container.querySelector('[data-slot="operational-alert-detail-body"]')?.textContent,
		).toContain('95%');
		expect(
			container.querySelector('[data-slot="operational-alert-detail-source"]')?.textContent,
		).toContain('disk-monitor');
	});

	it('shows the ack button when unacknowledged and the user can ack', () => {
		const { container } = render(OperationalAlertDetail, {
			props: { alert: makeAlert({ acknowledged: false }), messages: testMessages, canAck: true },
		});
		const ack = container.querySelector('[data-slot="operational-alert-ack"]');
		expect(ack).toBeTruthy();
		const form = ack?.closest('form');
		const hidden = form?.querySelector('input[name="action"]') as HTMLInputElement | null;
		expect(hidden?.value).toBe('acknowledge');
	});

	it('hides the ack button when the alert is already acknowledged', () => {
		const { container } = render(OperationalAlertDetail, {
			props: {
				alert: makeAlert({ acknowledged: true, acknowledgedAt: '2026-01-01T01:00:00.000Z' }),
				messages: testMessages,
				canAck: true,
			},
		});
		expect(container.querySelector('[data-slot="operational-alert-ack"]')).toBeNull();
	});

	it('hides the ack button when canAck is false', () => {
		const { container } = render(OperationalAlertDetail, {
			props: { alert: makeAlert({ acknowledged: false }), messages: testMessages, canAck: false },
		});
		expect(container.querySelector('[data-slot="operational-alert-ack"]')).toBeNull();
	});
});
