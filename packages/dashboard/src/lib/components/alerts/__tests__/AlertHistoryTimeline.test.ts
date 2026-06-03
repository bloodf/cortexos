/**
 * AlertHistoryTimeline.test.ts — verifies the timeline renders
 * events with their status, message, and rule name, and shows
 * the empty state when there are no events.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '../../../utils/test-render';
import AlertHistoryTimeline from '../AlertHistoryTimeline.svelte';
import { alertEventId } from '@cortexos/contracts';
import { testMessages } from './messages';
import type { AlertEvent } from '@cortexos/contracts';

function makeEvent(idx: number, overrides: Partial<AlertEvent> = {}): AlertEvent {
	const hex = idx.toString(16).padStart(8, '0');
	return {
		id: alertEventId(`${hex}-0000-4000-8000-000000000000`),
		ruleId: null,
		ruleName: `Rule ${idx}`,
		serviceId: null,
		serviceName: `Service ${idx}`,
		status: 'fired',
		severity: 'warning',
		message: `Event ${idx} message`,
		firedAt: `2026-01-0${idx}T00:00:00.000Z`,
		resolvedAt: null,
		durationSec: null,
		...overrides,
	};
}

describe('AlertHistoryTimeline', () => {
	afterEach(cleanup);

	it('renders one row per event', () => {
		const events = [makeEvent(1), makeEvent(2)];
		const { container } = render(AlertHistoryTimeline, {
			props: { events, messages: testMessages },
		});
		const rows = container.querySelectorAll('[data-slot="alert-history-row"]');
		expect(rows.length).toBe(2);
	});

	it('shows the empty state when there are no events', () => {
		const { container } = render(AlertHistoryTimeline, {
			props: { events: [], messages: testMessages },
		});
		expect(container.textContent).toContain('No alert history yet');
	});

	it('exposes the status via a data attribute', () => {
		const { container } = render(AlertHistoryTimeline, {
			props: {
				events: [makeEvent(1, { status: 'resolved' })],
				messages: testMessages,
			},
		});
		const row = container.querySelector('[data-slot="alert-history-row"]');
		expect(row?.getAttribute('data-status')).toBe('resolved');
		expect(
			container.querySelector('[data-slot="alert-history-status"]')?.textContent,
		).toContain('Resolved');
	});

	it('renders the rule name and message', () => {
		const { container } = render(AlertHistoryTimeline, {
			props: { events: [makeEvent(1)], messages: testMessages },
		});
		expect(
			container.querySelector('[data-slot="alert-history-rule-name"]')?.textContent,
		).toContain('Rule 1');
		expect(
			container.querySelector('[data-slot="alert-history-message"]')?.textContent,
		).toContain('Event 1 message');
	});
});
