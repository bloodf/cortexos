/**
 * UnitList.test.ts — exercises the table view's column rendering
 * (name, description, state badge, sub, enabled) and the empty state.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '../../../utils/test-render';
import UnitList from '../UnitList.svelte';
import en from '$lib/i18n/messages/en.json';
import type { Messages } from '$lib/i18n';
import type { SystemdUnit } from '@cortexos/contracts';

const messages: Messages = en;

const baseUnit: SystemdUnit = {
	name: 'caddy.service',
	description: 'Caddy HTTP/2 web server',
	load: 'loaded',
	active: 'active',
	sub: 'running',
	enabled: true,
	type: 'service',
	unitPath: '/etc/systemd/system/caddy.service',
	allowlisted: true,
	critical: false,
};

function makeUnit(overrides: Partial<SystemdUnit> = {}): SystemdUnit {
	return { ...baseUnit, ...overrides };
}

describe('UnitList', () => {
	afterEach(cleanup);

	it('renders one row per unit', () => {
		const units = [makeUnit(), makeUnit({ name: 'cron.service', description: 'cron' })];
		const { container } = render(UnitList, {
			props: { units, messages },
		});
		const rows = container.querySelectorAll('tbody [data-slot="table-row"]');
		expect(rows.length).toBe(2);
	});

	it('renders the localized column headers', () => {
		const { container } = render(UnitList, {
			props: { units: [makeUnit()], messages },
		});
		expect(container.textContent).toContain('Name');
		expect(container.textContent).toContain('Description');
		expect(container.textContent).toContain('Active');
		expect(container.textContent).toContain('Sub');
		expect(container.textContent).toContain('Enabled');
	});

	it('renders the state badge for each row', () => {
		const units = [makeUnit(), makeUnit({ name: 'redis.service', active: 'inactive' })];
		const { container } = render(UnitList, {
			props: { units, messages },
		});
		const badges = container.querySelectorAll('[data-slot="unit-state-badge"]');
		expect(badges.length).toBeGreaterThanOrEqual(2);
	});

	it('shows the DataTable empty state when there are no rows', () => {
		const { container } = render(UnitList, {
			props: { units: [], messages },
		});
		expect(container.textContent).toContain('No results');
	});

	it('paginates with a small page size', () => {
		const units = Array.from({ length: 6 }, (_, i) =>
			makeUnit({ name: `unit-${i}.service` }),
		);
		const { container } = render(UnitList, {
			props: { units, pageSize: 2, messages },
		});
		expect(container.textContent).toContain('Page 1 / 3');
	});

	it('renders the enabled flag per row', () => {
		const units = [makeUnit({ enabled: true }), makeUnit({ name: 'b.service', enabled: false })];
		const { container } = render(UnitList, {
			props: { units, messages },
		});
		const enabled = container.querySelectorAll('[data-slot="unit-enabled"]');
		expect(enabled.length).toBe(2);
		expect(enabled[0]?.getAttribute('data-enabled')).toBe('true');
		expect(enabled[1]?.getAttribute('data-enabled')).toBe('false');
	});
});
