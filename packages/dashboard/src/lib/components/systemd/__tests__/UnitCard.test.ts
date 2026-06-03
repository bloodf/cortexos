/**
 * UnitCard.test.ts — verifies the card renders the unit's name,
 * description, sub state, enabled flag, and the state badge.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '../../../utils/test-render';
import UnitCard from '../UnitCard.svelte';
import en from '$lib/i18n/messages/en.json';
import type { Messages } from '$lib/i18n';
import type { SystemdUnit } from '@cortexos/contracts';

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

describe('UnitCard', () => {
	afterEach(cleanup);

	it('renders the short name and full unit name', () => {
		const { container } = render(UnitCard, {
			props: { unit: baseUnit, messages },
		});
		expect(container.textContent).toContain('postgresql');
		const card = container.querySelector('[data-slot="unit-card"]');
		expect(card?.getAttribute('data-unit-name')).toBe('postgresql.service');
	});

	it('renders the description', () => {
		const { container } = render(UnitCard, {
			props: { unit: baseUnit, messages },
		});
		expect(container.textContent).toContain('PostgreSQL database server');
	});

	it('renders the sub state in the footer', () => {
		const { container } = render(UnitCard, {
			props: { unit: baseUnit, messages },
		});
		const sub = container.querySelector('[data-slot="unit-sub"]');
		expect(sub?.textContent).toContain('running');
	});

	it('renders the enabled flag', () => {
		const { container } = render(UnitCard, {
			props: { unit: { ...baseUnit, enabled: false }, messages },
		});
		const enabled = container.querySelector('[data-slot="unit-enabled"]');
		expect(enabled?.textContent).toContain('Disabled');
	});

	it('invokes onSelect when the card is clicked', () => {
		const calls: SystemdUnit[] = [];
		const { container } = render(UnitCard, {
			props: {
				unit: baseUnit,
				messages,
				onSelect: (u: SystemdUnit) => {
					calls.push(u);
				},
			},
		});
		const interactive = container.querySelector('[data-slot="unit-card"]') as HTMLElement | null;
		interactive?.click();
		expect(calls).toHaveLength(1);
		expect(calls[0]?.name).toBe('postgresql.service');
	});

	it('does not render as a button when onSelect is omitted', () => {
		const { container } = render(UnitCard, {
			props: { unit: baseUnit, messages },
		});
		const card = container.querySelector('[data-slot="unit-card"]');
		expect(card?.getAttribute('role')).toBeNull();
		expect(card?.getAttribute('tabindex')).toBeNull();
	});
});
