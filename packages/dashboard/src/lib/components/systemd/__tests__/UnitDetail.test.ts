/**
 * UnitDetail.test.ts — exercises the detail view's header, fields,
 * action bar wiring, and the empty-logs state.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '../../../utils/test-render';
import UnitDetail from '../UnitDetail.svelte';
import en from '$lib/i18n/messages/en.json';
import type { Messages } from '$lib/i18n';
import type { SystemdUnit, SystemdLogLine } from '@cortexos/contracts';

const messages: Messages = en;

const baseUnit: SystemdUnit = {
	name: 'postgresql.service',
	description: 'PostgreSQL database server',
	load: 'loaded',
	active: 'active',
	sub: 'running',
	enabled: true,
	type: 'service',
	unitPath: '/usr/lib/systemd/system/postgresql.service',
	allowlisted: true,
	critical: true,
};

const baseLogs: SystemdLogLine[] = [
	{
		ts: '2026-01-01T00:00:00Z',
		priority: 'info',
		unit: 'postgresql.service',
		message: 'database system is ready',
	},
	{
		ts: '2026-01-01T00:00:01Z',
		priority: 'warning',
		unit: 'postgresql.service',
		message: 'checkpoint complete',
	},
];

describe('UnitDetail', () => {
	afterEach(cleanup);

	it('renders the unit name in the title and the data-slot', () => {
		const { container } = render(UnitDetail, {
			props: {
				unit: baseUnit,
				logs: baseLogs,
				messages,
				isAdmin: true,
			},
		});
		expect(container.textContent).toContain('PostgreSQL database server');
		const name = container.querySelector('[data-slot="unit-field-name"]');
		expect(name?.textContent).toContain('postgresql.service');
	});

	it('renders the load / sub / enabled / critical / allowlisted fields', () => {
		const { container } = render(UnitDetail, {
			props: { unit: baseUnit, logs: [], messages, isAdmin: true },
		});
		expect(container.querySelector('[data-slot="unit-field-load"]')?.textContent).toContain('loaded');
		expect(container.querySelector('[data-slot="unit-field-sub"]')?.textContent).toContain('running');
		expect(container.querySelector('[data-slot="unit-field-enabled"]')?.textContent).toBe('true');
		expect(container.querySelector('[data-slot="unit-field-critical"]')?.textContent).toBe('true');
		expect(container.querySelector('[data-slot="unit-field-allowlisted"]')?.textContent).toBe('true');
		expect(container.querySelector('[data-slot="unit-field-type"]')?.textContent).toContain('service');
	});

	it('renders the action bar', () => {
		const { container } = render(UnitDetail, {
			props: { unit: baseUnit, logs: [], messages, isAdmin: true },
		});
		const bar = container.querySelector('[data-slot="unit-action-bar"]');
		expect(bar).not.toBeNull();
	});

	it('disables the action bar when the user is not admin', () => {
		const { container } = render(UnitDetail, {
			props: { unit: baseUnit, logs: [], messages, isAdmin: false },
		});
		const buttons = container.querySelectorAll('[data-slot="unit-action-button"] button');
		for (const b of buttons) {
			expect(b.hasAttribute('disabled')).toBe(true);
		}
	});

	it('renders log lines, newest first', () => {
		const { container } = render(UnitDetail, {
			props: { unit: baseUnit, logs: baseLogs, messages, isAdmin: true },
		});
		const rows = container.querySelectorAll('[data-slot="unit-logs-row"]');
		expect(rows.length).toBe(2);
	});

	it('renders the empty-logs state when there are no lines', () => {
		const { container } = render(UnitDetail, {
			props: { unit: baseUnit, logs: [], messages, isAdmin: true },
		});
		const empty = container.querySelector('[data-slot="unit-logs-empty"]');
		expect(empty).not.toBeNull();
	});
});
