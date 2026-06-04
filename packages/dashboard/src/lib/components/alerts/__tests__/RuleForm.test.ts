/**
 * RuleForm.test.ts — verifies the create form renders all the
 * expected fields, gates the threshold field on the condition,
 * and emits the right form verb (`create` vs `update`).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '../../../utils/test-render';
import RuleForm from '../RuleForm.svelte';
import { testMessages } from './messages';
import { alertRuleId } from '@cortexos/contracts';
import type { AlertRule } from '@cortexos/contracts';

const fixture: AlertRule = {
	id: alertRuleId('33333333-3333-4333-8333-333333333333'),
	name: 'Existing rule',
	serviceId: null,
	condition: 'offline',
	thresholdMs: null,
	severity: 'warning',
	channels: ['ui'],
	enabled: true,
	createdAt: '2026-01-01T00:00:00.000Z',
	updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('RuleForm', () => {
	afterEach(cleanup);

	it('emits action=create for a new rule', () => {
		const { container } = render(RuleForm, {
			props: { messages: testMessages },
		});
		const form = container.querySelector('[data-slot="rule-form"]');
		expect(form?.getAttribute('data-form-verb')).toBe('create');
		const hidden = form?.querySelector('input[name="action"]') as HTMLInputElement | null;
		expect(hidden?.value).toBe('create');
	});

	it('emits action=update when an existing rule is provided', () => {
		const { container } = render(RuleForm, {
			props: { messages: testMessages, rule: fixture },
		});
		const form = container.querySelector('[data-slot="rule-form"]');
		expect(form?.getAttribute('data-form-verb')).toBe('update');
		const hidden = form?.querySelector('input[name="action"]') as HTMLInputElement | null;
		expect(hidden?.value).toBe('update');
	});

	it('hides the threshold field when condition is offline', () => {
		const { container } = render(RuleForm, {
			props: { messages: testMessages, rule: fixture },
		});
		expect(container.querySelector('input[name="thresholdMs"]')).toBeNull();
	});

	it('shows the threshold field when condition is response_time', () => {
		const { container } = render(RuleForm, {
			props: {
				messages: testMessages,
				rule: { ...fixture, condition: 'response_time', thresholdMs: 750 },
			},
		});
		const threshold = container.querySelector('input[name="thresholdMs"]') as HTMLInputElement | null;
		expect(threshold).toBeTruthy();
		expect(threshold?.value).toBe('750');
	});

	it('renders the channel checkboxes', () => {
		const { container } = render(RuleForm, {
			props: { messages: testMessages },
		});
		const channels = container.querySelectorAll('input[name="channels"]');
		expect(channels.length).toBe(4);
	});
});
