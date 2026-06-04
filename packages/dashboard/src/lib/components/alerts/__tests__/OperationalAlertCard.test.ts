/**
 * OperationalAlertCard.test.ts — verifies the card renders the
 * alert's title, source, severity badge, and the acknowledged
 * state via data attributes.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '../../../utils/test-render';
import OperationalAlertCard from '../OperationalAlertCard.svelte';
import { testMessages } from './messages';
import type { OperationalAlert } from '@cortexos/contracts';

function makeAlert(overrides: Partial<OperationalAlert> = {}): OperationalAlert {
	return {
		id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' as OperationalAlert['id'],
		severity: 'warning',
		title: 'Service unreachable',
		message: 'The service has not responded to 3 consecutive probes.',
		source: 'health-probe',
		createdAt: '2026-01-01T00:00:00.000Z',
		acknowledged: false,
		acknowledgedBy: null,
		acknowledgedAt: null,
		...overrides,
	};
}

describe('OperationalAlertCard', () => {
	afterEach(cleanup);

	it('renders the alert title and source', () => {
		const { container } = render(OperationalAlertCard, {
			props: { alert: makeAlert(), messages: testMessages },
		});
		expect(container.textContent).toContain('Service unreachable');
		expect(
			container.querySelector('[data-slot="operational-alert-source"]')?.textContent,
		).toContain('health-probe');
	});

	it('exposes severity and acknowledged via data attributes', () => {
		const { container } = render(OperationalAlertCard, {
			props: { alert: makeAlert({ severity: 'critical', acknowledged: true }), messages: testMessages },
		});
		const card = container.querySelector('[data-slot="operational-alert-card"]');
		expect(card?.getAttribute('data-severity')).toBe('critical');
		expect(card?.getAttribute('data-acknowledged')).toBe('true');
	});

	it('shows the unacknowledged label when not yet acked', () => {
		const { container } = render(OperationalAlertCard, {
			props: { alert: makeAlert({ acknowledged: false }), messages: testMessages },
		});
		expect(
			container.querySelector('[data-slot="operational-alert-acked"]')?.textContent,
		).toContain('Unacknowledged');
	});

	it('invokes onSelect when clicked', () => {
		const calls: OperationalAlert[] = [];
		const alert = makeAlert();
		const { container } = render(OperationalAlertCard, {
			props: {
				alert,
				messages: testMessages,
				onSelect: (a: OperationalAlert) => {
					calls.push(a);
				},
			},
		});
		const card = container.querySelector(
			'[data-slot="operational-alert-card"]',
		) as HTMLElement | null;
		card?.click();
		expect(calls).toHaveLength(1);
		expect(calls[0]?.title).toBe('Service unreachable');
	});
});
