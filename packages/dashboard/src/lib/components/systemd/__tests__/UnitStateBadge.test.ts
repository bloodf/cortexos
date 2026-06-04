/**
 * UnitStateBadge.test.ts — exhaustive over the `SystemdActiveState`
 * union. Adding a new state to the contracts package forces a compile
 * error in the badge component (the switch is exhaustive), and these
 * tests assert the visible label + variant for every state.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '../../../utils/test-render';
import UnitStateBadge from '../UnitStateBadge.svelte';
import en from '$lib/i18n/messages/en.json';
import type { Messages } from '$lib/i18n';

const messages: Messages = en;

describe('UnitStateBadge', () => {
	afterEach(cleanup);

	const cases: Array<{
		state:
			| 'active'
			| 'inactive'
			| 'failed'
			| 'activating'
			| 'deactivating'
			| 'reloading'
			| 'maintenance'
			| 'unknown';
		variantClass: string;
		label: string;
	}> = [
		{ state: 'active', variantClass: 'text-success', label: 'Active' },
		{ state: 'inactive', variantClass: 'text-secondary-foreground', label: 'Inactive' },
		{ state: 'failed', variantClass: 'text-destructive', label: 'Failed' },
		{ state: 'activating', variantClass: 'text-info', label: 'Activating' },
		{ state: 'deactivating', variantClass: 'text-warning', label: 'Deactivating' },
		{ state: 'reloading', variantClass: 'text-info', label: 'Reloading' },
		{ state: 'maintenance', variantClass: 'text-warning', label: 'Maintenance' },
		{ state: 'unknown', variantClass: 'text-foreground', label: 'Unknown' },
	];

	it.each(cases)('renders state=$state with the correct variant', ({ state, variantClass, label }) => {
		const { container } = render(UnitStateBadge, {
			props: { state, messages },
		});
		const span = container.querySelector('[data-slot="unit-state-badge"]');
		expect(span).not.toBeNull();
		expect(span?.getAttribute('data-state')).toBe(state);
		expect(span?.textContent?.trim()).toBe(label);
		const badge = container.querySelector('[data-slot="badge"]');
		expect(badge?.className).toContain(variantClass);
	});

	it('honors a custom label override', () => {
		const { container } = render(UnitStateBadge, {
			props: { state: 'failed', label: 'crashed', messages },
		});
		const span = container.querySelector('[data-slot="unit-state-badge"]');
		expect(span?.textContent?.trim()).toBe('crashed');
	});

	it('uses the requested size', () => {
		const { container } = render(UnitStateBadge, {
			props: { state: 'active', size: 'sm', messages },
		});
		const badge = container.querySelector('[data-slot="badge"]');
		expect(badge?.className).toContain('h-4');
	});
});
