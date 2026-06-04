/**
 * AlertSeverityBadge.test.ts — verifies the badge maps every
 * severity value to the right variant and i18n key.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '../../../utils/test-render';
import AlertSeverityBadge from '../AlertSeverityBadge.svelte';
import { testMessages } from './messages';

describe('AlertSeverityBadge', () => {
	afterEach(cleanup);

	it('maps "info" to the info variant with the i18n label', () => {
		const { container } = render(AlertSeverityBadge, {
			props: { severity: 'info', messages: testMessages },
		});
		const badge = container.querySelector('[data-slot="alert-severity-badge"]');
		expect(badge?.getAttribute('data-severity')).toBe('info');
		expect(badge?.textContent?.trim()).toBe('Info');
		expect(badge?.getAttribute('aria-label')).toContain('Info');
	});

	it('maps "warning" to the warning variant', () => {
		const { container } = render(AlertSeverityBadge, {
			props: { severity: 'warning', messages: testMessages },
		});
		const badge = container.querySelector('[data-slot="alert-severity-badge"]');
		expect(badge?.getAttribute('data-severity')).toBe('warning');
		expect(badge?.textContent?.trim()).toBe('Warning');
	});

	it('maps "critical" to the destructive variant', () => {
		const { container } = render(AlertSeverityBadge, {
			props: { severity: 'critical', messages: testMessages },
		});
		const badge = container.querySelector('[data-slot="alert-severity-badge"]');
		expect(badge?.getAttribute('data-severity')).toBe('critical');
		expect(badge?.textContent?.trim()).toBe('Critical');
	});

	it('uses the override label when provided', () => {
		const { container } = render(AlertSeverityBadge, {
			props: { severity: 'info', messages: testMessages, label: 'Notice' },
		});
		const badge = container.querySelector('[data-slot="alert-severity-badge"]');
		expect(badge?.textContent?.trim()).toBe('Notice');
	});
});
