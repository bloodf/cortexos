/**
 * ServiceHealthBadge.test.ts — exhaustive over the ServiceStatus
 * union. Adding a new status breaks this file's `it.each` compile
 * (the union narrows).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '../../../utils/test-render';
import ServiceHealthBadge from '../ServiceHealthBadge.svelte';
import { testMessages } from './messages';

describe('ServiceHealthBadge', () => {
	afterEach(cleanup);

	const cases: Array<{
		status: 'online' | 'offline' | 'unknown' | 'checking' | 'degraded';
		variantClass: string;
		label: string;
	}> = [
		{ status: 'online', variantClass: 'text-success', label: 'Online' },
		{ status: 'offline', variantClass: 'text-destructive', label: 'Offline' },
		{ status: 'degraded', variantClass: 'text-warning', label: 'Degraded' },
		{ status: 'checking', variantClass: 'text-info', label: 'Checking' },
		{ status: 'unknown', variantClass: 'text-secondary-foreground', label: 'Unknown' },
	];

	it.each(cases)('renders status=$status with the correct variant', ({ status, variantClass, label }) => {
		const { container } = render(ServiceHealthBadge, {
			props: { status, messages: testMessages },
		});
		const span = container.querySelector('[data-slot="service-health-badge"]');
		expect(span).not.toBeNull();
		expect(span?.getAttribute('data-status')).toBe(status);
		expect(span?.textContent?.trim()).toBe(label);
		const badge = container.querySelector('[data-slot="badge"]');
		expect(badge?.className).toContain(variantClass);
	});

	it('honors a custom label override', () => {
		const { container } = render(ServiceHealthBadge, {
			props: { status: 'offline', label: 'Down for maintenance', messages: testMessages },
		});
		const span = container.querySelector('[data-slot="service-health-badge"]');
		expect(span?.textContent?.trim()).toBe('Down for maintenance');
	});

	it('uses the requested size', () => {
		const { container } = render(ServiceHealthBadge, {
			props: { status: 'online', size: 'sm', messages: testMessages },
		});
		const badge = container.querySelector('[data-slot="badge"]');
		expect(badge?.className).toContain('h-4');
	});
});
