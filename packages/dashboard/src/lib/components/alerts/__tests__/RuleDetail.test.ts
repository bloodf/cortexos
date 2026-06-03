/**
 * RuleDetail.test.ts — verifies the rule detail card renders the
 * rule's metadata and the enable / disable form action when the
 * user is allowed to toggle.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '../../../utils/test-render';
import RuleDetail from '../RuleDetail.svelte';
import { alertRuleId } from '@cortexos/contracts';
import { testMessages } from './messages';
import type { AlertRule } from '@cortexos/contracts';

function makeRule(overrides: Partial<AlertRule> = {}): AlertRule {
	return {
		id: alertRuleId('22222222-2222-4222-8222-222222222222'),
		name: 'Disk pressure',
		serviceId: null,
		condition: 'offline',
		thresholdMs: null,
		severity: 'critical',
		channels: ['ui'],
		enabled: true,
		createdAt: '2026-01-01T00:00:00.000Z',
		updatedAt: '2026-01-02T00:00:00.000Z',
		...overrides,
	};
}

describe('RuleDetail', () => {
	afterEach(cleanup);

	it('renders the rule name and all metadata fields', () => {
		const { container } = render(RuleDetail, {
			props: { rule: makeRule(), messages: testMessages, canToggle: false },
		});
		expect(container.textContent).toContain('Disk pressure');
		expect(container.querySelector('[data-slot="rule-detail-condition"]')?.textContent).toContain(
			'offline',
		);
		expect(
			container.querySelector('[data-slot="rule-detail-enabled"]')?.getAttribute('data-enabled'),
		).toBe('true');
	});

	it('shows the disable form when the rule is enabled and the user can toggle', () => {
		const { container } = render(RuleDetail, {
			props: { rule: makeRule({ enabled: true }), messages: testMessages, canToggle: true },
		});
		const toggle = container.querySelector('[data-slot="rule-toggle"]');
		expect(toggle?.getAttribute('data-action')).toBe('disable');
		expect(toggle?.textContent).toContain('Disable');
	});

	it('shows the enable form when the rule is disabled and the user can toggle', () => {
		const { container } = render(RuleDetail, {
			props: { rule: makeRule({ enabled: false }), messages: testMessages, canToggle: true },
		});
		const toggle = container.querySelector('[data-slot="rule-toggle"]');
		expect(toggle?.getAttribute('data-action')).toBe('enable');
		expect(toggle?.textContent).toContain('Enable');
	});

	it('hides the form when the user cannot toggle', () => {
		const { container } = render(RuleDetail, {
			props: { rule: makeRule(), messages: testMessages, canToggle: false },
		});
		expect(container.querySelector('[data-slot="rule-toggle"]')).toBeNull();
	});

	it('renders the threshold when the condition is response_time', () => {
		const { container } = render(RuleDetail, {
			props: {
				rule: makeRule({ condition: 'response_time', thresholdMs: 250 }),
				messages: testMessages,
				canToggle: false,
			},
		});
		expect(container.querySelector('[data-slot="rule-detail-threshold"]')?.textContent).toContain(
			'250ms',
		);
	});
});
