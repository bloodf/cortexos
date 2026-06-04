/**
 * AuditResultBadge.test.ts — exhaustive mapping + a11y attrs.
 */
import { describe, it, expect, afterEach } from 'vitest';
import type { ComponentProps } from 'svelte';
import { render, cleanup } from '../../../utils/test-render';
import AuditResultBadge from '../AuditResultBadge.svelte';
import { testMessages } from './messages';

afterEach(cleanup);

type BadgeProps = ComponentProps<typeof AuditResultBadge>;

function renderBadge(
	result: BadgeProps['result'],
	over: Pick<BadgeProps, 'label' | 'size'> = {},
) {
	return render(AuditResultBadge, {
		props: { result, messages: testMessages, ...over },
	});
}

describe('AuditResultBadge', () => {
	it('renders a Success variant for result=success', () => {
		const { container } = renderBadge('success');
		const inner = container.querySelector('[data-slot="audit-result-badge"]');
		expect(inner).not.toBeNull();
		expect(inner?.getAttribute('data-result')).toBe('success');
	});

	it('maps failure → destructive', () => {
		const { container } = renderBadge('failure');
		expect(container.querySelector('[data-result="failure"]')).not.toBeNull();
	});

	it('maps denied → warning', () => {
		const { container } = renderBadge('denied');
		expect(container.querySelector('[data-result="denied"]')).not.toBeNull();
	});

	it('maps error → secondary', () => {
		const { container } = renderBadge('error');
		expect(container.querySelector('[data-result="error"]')).not.toBeNull();
	});

	it('sets the aria-label to "<prefix>: <label>"', () => {
		const { container } = renderBadge('success');
		const inner = container.querySelector('[data-slot="audit-result-badge"]');
		expect(inner?.getAttribute('aria-label')).toBe('Result: Success');
	});

	it('honors a custom label override', () => {
		const { container } = renderBadge('success', { label: 'OK' });
		const inner = container.querySelector('[data-slot="audit-result-badge"]');
		expect(inner?.textContent?.trim()).toBe('OK');
	});
});
