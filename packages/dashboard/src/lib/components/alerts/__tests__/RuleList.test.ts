/**
 * RuleList.test.ts — verifies the list renders one card per rule
 * and shows the empty state when there are no rules.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '../../../utils/test-render';
import RuleList from '../RuleList.svelte';
import { alertRuleId } from '@cortexos/contracts';
import { testMessages } from './messages';
import type { AlertRule } from '@cortexos/contracts';

function makeRule(idx: number, overrides: Partial<AlertRule> = {}): AlertRule {
	const hex = idx.toString(16).padStart(8, '0');
	return {
		id: alertRuleId(`${hex}-1111-4111-8111-111111111111`),
		name: `Rule ${idx}`,
		serviceId: null,
		condition: 'offline',
		thresholdMs: null,
		severity: 'warning',
		channels: ['ui'],
		enabled: true,
		createdAt: '2026-01-01T00:00:00.000Z',
		updatedAt: '2026-01-01T00:00:00.000Z',
		...overrides,
	};
}

describe('RuleList', () => {
	afterEach(cleanup);

	it('renders one card per rule', () => {
		const rules = [makeRule(1), makeRule(2), makeRule(3)];
		const { container } = render(RuleList, {
			props: { rules, messages: testMessages },
		});
		const cards = container.querySelectorAll('[data-slot="rule-card"]');
		expect(cards.length).toBe(3);
	});

	it('shows the empty state when there are no rules', () => {
		const { container } = render(RuleList, {
			props: { rules: [], messages: testMessages },
		});
		expect(container.textContent).toContain('No alert rules configured');
	});

	it('uses the grid container with the list data slot', () => {
		const { container } = render(RuleList, {
			props: { rules: [makeRule(1)], messages: testMessages },
		});
		expect(container.querySelector('[data-slot="rule-list"]')).toBeTruthy();
	});
});
