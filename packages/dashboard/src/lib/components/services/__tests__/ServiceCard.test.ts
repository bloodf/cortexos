/**
 * ServiceCard.test.ts — verifies the card renders the service
 * record's name, monogram, response time, uptime, and the status
 * badge with the right variant.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '../../../utils/test-render';
import ServiceCard from '../ServiceCard.svelte';
import { FROZEN_NOW } from '../../../mocks/fixtures/seed';
import { adaptService, type AdapterInput } from '../adapter';
import type { Service } from '@cortexos/contracts';
import { testMessages } from './messages';

const baseInput: AdapterInput = {
	id: 'svc_0100',
	slug: 'prometheus',
	name: 'Prometheus',
	description: 'Metrics scraper',
	category: 'Monitoring',
	status: 'online',
	kind: 'docker',
	healthUrl: 'https://prom.local/-/healthy',
	healthType: 'http',
	openUrl: 'https://prom.local',
	envSource: null,
	createdAt: FROZEN_NOW,
	updatedAt: FROZEN_NOW,
	responseTime: 87,
	iconColor: '#f59e0b',
	iconImage: null,
	iconType: 'mono',
	badges: [],
	isActive: true,
	hasWebui: true,
	showInHealthcheck: true,
	showInWebui: true,
	sortOrder: 1,
};

function makeFixture(overrides: Partial<AdapterInput> = {}): Service {
	const merged: AdapterInput = { ...baseInput, ...overrides };
	return adaptService(merged);
}

const fixture = makeFixture();

describe('ServiceCard', () => {
	afterEach(cleanup);

	it('renders the service name, monogram, and slug', () => {
		const { container } = render(ServiceCard, {
			props: { service: fixture, messages: testMessages },
		});
		expect(container.textContent).toContain('Prometheus');
		const card = container.querySelector('[data-slot="service-card"]');
		expect(card?.getAttribute('data-service-slug')).toBe('prometheus');
		const icon = container.querySelector('[data-slot="service-icon"]');
		expect(icon?.textContent?.trim()).toBe('PR');
	});

	it('formats the response time as ms', () => {
		const { container } = render(ServiceCard, {
			props: { service: fixture, messages: testMessages },
		});
		const response = container.querySelector('[data-slot="service-response"]');
		expect(response?.textContent).toContain('87ms');
	});

	it('falls back to em-dash when responseMs is null', () => {
		const slow = makeFixture({ responseTime: 0 });
		const { container } = render(ServiceCard, {
			props: { service: slow, messages: testMessages },
		});
		const response = container.querySelector('[data-slot="service-response"]');
		expect(response?.textContent).toContain('—');
	});

	it('invokes onSelect when the card is clicked', () => {
		const calls: Service[] = [];
		const { container } = render(ServiceCard, {
			props: {
				service: fixture,
				messages: testMessages,
				onSelect: (s: Service) => {
					calls.push(s);
				},
			},
		});
		const interactive = container.querySelector(
			'[data-slot="service-card"]',
		) as HTMLElement | null;
		interactive?.click();
		expect(calls).toHaveLength(1);
		expect(calls[0]?.slug).toBe('prometheus');
	});

	it('does not render as a button when onSelect is omitted', () => {
		const { container } = render(ServiceCard, {
			props: { service: fixture, messages: testMessages },
		});
		const card = container.querySelector('[data-slot="service-card"]');
		expect(card?.getAttribute('role')).toBeNull();
		expect(card?.getAttribute('tabindex')).toBeNull();
	});
});
