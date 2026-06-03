/**
 * UnitActionBar.test.ts — exercises the action bar's button matrix
 * (start/stop/restart/reload/enable/disable), the destructive flag,
 * the admin-only disabled state, and the onAction dispatch.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '../../../utils/test-render';
import UnitActionBar from '../UnitActionBar.svelte';
import en from '$lib/i18n/messages/en.json';
import type { Messages } from '$lib/i18n';
import type { UnitActionKind } from '../adapter';

const messages: Messages = en;

describe('UnitActionBar', () => {
	afterEach(cleanup);

	it('renders one button per action', () => {
		const { container } = render(UnitActionBar, {
			props: { canAct: true, messages },
		});
		const buttons = container.querySelectorAll('[data-slot="unit-action-button"]');
		expect(buttons.length).toBe(6);
	});

	it('marks destructive actions with data-destructive=true', () => {
		const { container } = render(UnitActionBar, {
			props: { canAct: true, messages },
		});
		const restart = container.querySelector(
			'[data-action="restart"]',
		) as HTMLElement | null;
		const start = container.querySelector(
			'[data-action="start"]',
		) as HTMLElement | null;
		expect(restart?.getAttribute('data-destructive')).toBe('true');
		expect(start?.getAttribute('data-destructive')).toBe('false');
	});

	it('disables all buttons when canAct is false (non-admin)', () => {
		const { container } = render(UnitActionBar, {
			props: { canAct: false, messages },
		});
		const buttons = container.querySelectorAll('[data-slot="unit-action-button"] button');
		for (const b of buttons) {
			expect(b.hasAttribute('disabled')).toBe(true);
		}
	});

	it('dispatches onAction with the clicked action', () => {
		const calls: UnitActionKind[] = [];
		const { container } = render(UnitActionBar, {
			props: {
				canAct: true,
				messages,
				onAction: (a: UnitActionKind) => {
					calls.push(a);
				},
			},
		});
		const restart = container.querySelector(
			'[data-action="restart"] button',
		) as HTMLButtonElement | null;
		restart?.click();
		expect(calls).toEqual(['restart']);
	});

	it('does not dispatch when canAct is false', () => {
		const calls: UnitActionKind[] = [];
		const { container } = render(UnitActionBar, {
			props: {
				canAct: false,
				messages,
				onAction: (a: UnitActionKind) => {
					calls.push(a);
				},
			},
		});
		const restart = container.querySelector(
			'[data-action="restart"] button',
		) as HTMLButtonElement | null;
		restart?.click();
		expect(calls).toEqual([]);
	});
});
