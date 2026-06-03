/**
 * UnitLogs.test.ts — the log table renders one row per line with the
 * priority data attribute; the empty state shows when there are no
 * lines.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '../../../utils/test-render';
import UnitLogs from '../UnitLogs.svelte';
import en from '$lib/i18n/messages/en.json';
import type { Messages } from '$lib/i18n';
import type { SystemdLogLine } from '@cortexos/contracts';

const messages: Messages = en;

const lines: SystemdLogLine[] = [
	{ ts: '2026-01-01T00:00:00Z', priority: 'info', unit: 'caddy.service', message: 'a' },
	{ ts: '2026-01-01T00:00:01Z', priority: 'err', unit: 'caddy.service', message: 'b' },
];

describe('UnitLogs', () => {
	afterEach(cleanup);

	it('renders one row per log line', () => {
		const { container } = render(UnitLogs, {
			props: {
				logs: lines,
				messages,
				title: 'Recent',
				description: 'desc',
				emptyLabel: 'No lines',
			},
		});
		const rows = container.querySelectorAll('[data-slot="unit-logs-row"]');
		expect(rows.length).toBe(2);
	});

	it('exposes the priority on the row for CSS / tests', () => {
		const { container } = render(UnitLogs, {
			props: {
				logs: lines,
				messages,
				title: 'Recent',
				description: 'desc',
				emptyLabel: 'No lines',
			},
		});
		const rows = container.querySelectorAll('[data-slot="unit-logs-row"]');
		expect(rows[0]?.getAttribute('data-priority')).toBe('info');
		expect(rows[1]?.getAttribute('data-priority')).toBe('err');
	});

	it('renders the empty state when there are no lines', () => {
		const { container } = render(UnitLogs, {
			props: {
				logs: [],
				messages,
				title: 'Recent',
				description: 'desc',
				emptyLabel: 'No lines',
			},
		});
		const empty = container.querySelector('[data-slot="unit-logs-empty"]');
		expect(empty?.textContent).toContain('No lines');
	});

	it('renders the localized column headers', () => {
		const { container } = render(UnitLogs, {
			props: {
				logs: lines,
				messages,
				title: 'Recent',
				description: 'desc',
				emptyLabel: 'No lines',
			},
		});
		expect(container.textContent).toContain('Timestamp');
		expect(container.textContent).toContain('Priority');
		expect(container.textContent).toContain('Message');
	});
});
