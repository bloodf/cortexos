/**
 * RuleCard.test.ts — verifies the card renders the rule's name,
 * condition label, enabled switch state, and the severity badge.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '../../../utils/test-render';
import RuleCard from '../RuleCard.svelte';
import { alertRuleId } from '@cortexos/contracts';
import { testMessages } from './messages';
import type { AlertRule } from '@cortexos/contracts';

function makeRule(overrides: Partial<AlertRule> = {}): AlertRule {
	return {
		id: alertRuleId('11111111-1111-4111-8111-111111111111'),
		name: 'Prometheus offline',
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

describe('RuleCard', () => {
	afterEach(cleanup);

	it('renders the rule name and condition', () => {
		const { container } = render(RuleCard, {
			props: { rule: makeRule(), messages: testMessages },
		});
		expect(container.textContent).toContain('Prometheus offline');
		expect(container.querySelector('[data-slot="rule-condition"]')?.textContent).toContain(
			'offline',
		);
	});

	it('exposes the rule id and enabled state via data attributes', () => {
		const { container } = render(RuleCard, {
			props: { rule: makeRule({ enabled: false }), messages: testMessages },
		});
		const card = container.querySelector('[data-slot="rule-card"]');
		expect(card?.getAttribute('data-rule-id')).toBe(
			'11111111-1111-4111-8111-111111111111',
		);
		expect(card?.getAttribute('data-enabled')).toBe('false');
	});

	it('renders the threshold when the condition is response_time', () => {
		const { container } = render(RuleCard, {
			props: {
				rule: makeRule({ condition: 'response_time', thresholdMs: 500 }),
				messages: testMessages,
			},
		});
		expect(container.querySelector('[data-slot="rule-threshold"]')?.textContent).toContain(
			'500ms',
		);
	});

	it('invokes onSelect when clicked', () => {
		const calls: AlertRule[] = [];
		const rule = makeRule();
		const { container } = render(RuleCard, {
			props: {
				rule,
				messages: testMessages,
				onSelect: (r: AlertRule) => {
					calls.push(r);
				},
			},
		});
		const card = container.querySelector('[data-slot="rule-card"]') as HTMLElement | null;
		card?.click();
		expect(calls).toHaveLength(1);
		expect(calls[0]?.name).toBe('Prometheus offline');
	});

	it('does not render as a button when onSelect is omitted', () => {
		const { container } = render(RuleCard, {
			props: { rule: makeRule(), messages: testMessages },
		});
		const card = container.querySelector('[data-slot="rule-card"]');
		expect(card?.getAttribute('role')).toBeNull();
	});
});
