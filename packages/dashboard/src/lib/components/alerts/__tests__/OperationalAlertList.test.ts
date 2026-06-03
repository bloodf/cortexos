/**
 * OperationalAlertList.test.ts — verifies the list renders one
 * card per alert and shows the empty state when there are none.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '../../../utils/test-render';
import OperationalAlertList from '../OperationalAlertList.svelte';
import { testMessages } from './messages';
import type { OperationalAlert } from '@cortexos/contracts';

function makeAlert(idx: number): OperationalAlert {
	return {
		id: `0000000${idx}-0000-4000-8000-000000000000` as OperationalAlert['id'],
		severity: 'info',
		title: `Alert ${idx}`,
		message: 'msg',
		source: 'src',
		createdAt: '2026-01-01T00:00:00.000Z',
		acknowledged: false,
		acknowledgedBy: null,
		acknowledgedAt: null,
	};
}

describe('OperationalAlertList', () => {
	afterEach(cleanup);

	it('renders one card per alert', () => {
		const alerts = [makeAlert(1), makeAlert(2)];
		const { container } = render(OperationalAlertList, {
			props: { alerts, messages: testMessages },
		});
		const cards = container.querySelectorAll('[data-slot="operational-alert-card"]');
		expect(cards.length).toBe(2);
	});

	it('shows the empty state when there are no alerts', () => {
		const { container } = render(OperationalAlertList, {
			props: { alerts: [], messages: testMessages },
		});
		expect(container.textContent).toContain('No operational alerts');
	});

	it('uses the grid container with the list data slot', () => {
		const { container } = render(OperationalAlertList, {
			props: { alerts: [makeAlert(1)], messages: testMessages },
		});
		expect(container.querySelector('[data-slot="operational-alert-list"]')).toBeTruthy();
	});
});
