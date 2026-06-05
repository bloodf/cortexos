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

	it('formats the response time as seconds when >= 1000', () => {
		const slow = makeFixture({ responseTime: 1500 });
		const { container } = render(ServiceCard, {
			props: { service: slow, messages: testMessages },
		});
		const response = container.querySelector('[data-slot="service-response"]');
		expect(response?.textContent).toContain('1.50s');
	});

	it('formats the response time at exactly 1000 as seconds', () => {
		const slow = makeFixture({ responseTime: 1000 });
		const { container } = render(ServiceCard, {
			props: { service: slow, messages: testMessages },
		});
		const response = container.querySelector('[data-slot="service-response"]');
		expect(response?.textContent).toContain('1.00s');
	});

	it('renders the uptime when uptime24h is set', () => {
		// adapter doesn't currently expose uptime24h, but the component
		// will render the span if it's present on the Service object.
		const svc = { ...fixture, uptime24h: 99.95 } as Service;
		const { container } = render(ServiceCard, {
			props: { service: svc, messages: testMessages },
		});
		const uptime = container.querySelector('[data-slot="service-uptime"]');
		expect(uptime).not.toBeNull();
		expect(uptime?.textContent).toContain('99.95%');
	});

	it('does not render the uptime span when uptime24h is null', () => {
		const { container } = render(ServiceCard, {
			props: { service: fixture, messages: testMessages },
		});
		const uptime = container.querySelector('[data-slot="service-uptime"]');
		expect(uptime).toBeNull();
	});

	it('renders a monogram of "?" for an empty slug', () => {
		const noSlug = { ...fixture, slug: '' } as Service;
		const { container } = render(ServiceCard, {
			props: { service: noSlug, messages: testMessages },
		});
		const icon = container.querySelector('[data-slot="service-icon"]');
		expect(icon?.textContent?.trim()).toBe('?');
	});

	it('strips non-alphanumeric characters from the monogram', () => {
		const slashed = { ...fixture, slug: 'my-service.v2' } as Service;
		const { container } = render(ServiceCard, {
			props: { service: slashed, messages: testMessages },
		});
		const icon = container.querySelector('[data-slot="service-icon"]');
		expect(icon?.textContent?.trim()).toBe('MY');
	});

	it('renders the description when present', () => {
		const { container } = render(ServiceCard, {
			props: { service: fixture, messages: testMessages },
		});
		expect(container.textContent).toContain('Metrics scraper');
	});

	it('invokes onSelect when Enter is pressed on the card', () => {
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
		interactive?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		expect(calls).toHaveLength(1);
	});

	it('invokes onSelect when Space is pressed on the card', () => {
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
		interactive?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
		expect(calls).toHaveLength(1);
	});

	it('ignores other keys on the card', () => {
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
		interactive?.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
		expect(calls).toHaveLength(0);
	});
});
