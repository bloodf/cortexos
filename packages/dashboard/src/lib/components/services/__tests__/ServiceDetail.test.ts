/**
 * ServiceDetail.test.ts — verifies the detail view renders every
 * section (header, health, config, history) and that the
 * "Recheck now" button calls the provided handler.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '../../../utils/test-render';
import userEvent from '@testing-library/user-event';
import ServiceDetail from '../ServiceDetail.svelte';
import { FROZEN_NOW } from '../../../mocks/fixtures/seed';
import { adaptService, adaptHealthSnapshot } from '../adapter';
import { testMessages } from './messages';

const baseService = adaptService({
	id: 'svc_detail',
	slug: 'detail',
	name: 'Detail Service',
	description: 'A long description that should be visible in the header.',
	category: 'Monitoring',
	status: 'online',
	responseTime: 33,
	iconColor: '#10b981',
	iconImage: null,
	openUrl: 'https://detail.local',
	healthUrl: 'https://detail.local/healthz',
	healthType: 'http',
	kind: 'docker',
	envSource: '/etc/detail.env',
	isActive: true,
	hasWebui: true,
	showInHealthcheck: true,
	showInWebui: true,
	sortOrder: 0,
	iconType: 'mono',
	badges: [],
	createdAt: FROZEN_NOW,
	updatedAt: FROZEN_NOW,
} as Parameters<typeof adaptService>[0]);

const sampleHistory = [
	adaptHealthSnapshot({
		id: 'snap_001',
		serviceId: 'svc_detail',
		status: 'online',
		latencyMs: 12,
		checkedAt: FROZEN_NOW,
	} as Parameters<typeof adaptHealthSnapshot>[0]),
	adaptHealthSnapshot({
		id: 'snap_002',
		serviceId: 'svc_detail',
		status: 'degraded',
		latencyMs: 999,
		checkedAt: FROZEN_NOW,
	} as Parameters<typeof adaptHealthSnapshot>[0]),
];

describe('ServiceDetail', () => {
	afterEach(cleanup);

	it('renders the service name, description, and the status badge', () => {
		const { container } = render(ServiceDetail, {
			props: { service: baseService, history: sampleHistory, messages: testMessages },
		});
		expect(container.textContent).toContain('Detail Service');
		expect(container.textContent).toContain('A long description');
		expect(container.querySelector('[data-slot="service-health-badge"]')).not.toBeNull();
	});

	it('renders the health + config + history sections', () => {
		const { container } = render(ServiceDetail, {
			props: { service: baseService, history: sampleHistory, messages: testMessages },
		});
		expect(container.textContent).toContain('Health');
		expect(container.textContent).toContain('Config');
		expect(container.textContent).toContain('Health history');
	});

	it('formats the response time correctly', () => {
		const { container } = render(ServiceDetail, {
			props: { service: baseService, history: [], messages: testMessages },
		});
		const response = container.querySelector('[data-slot="service-response"]');
		expect(response?.textContent).toContain('33ms');
	});

	it('renders the history table with one row per snapshot', () => {
		const { container } = render(ServiceDetail, {
			props: { service: baseService, history: sampleHistory, messages: testMessages },
		});
		const rows = container.querySelectorAll('[data-slot="service-history-row"]');
		expect(rows.length).toBe(2);
	});

	it('shows the empty-state copy when there is no history', () => {
		const { container } = render(ServiceDetail, {
			props: { service: baseService, history: [], messages: testMessages },
		});
		expect(container.textContent).toContain('No probes recorded yet');
	});

	it('invokes onRecheck when the user clicks the button', async () => {
		const user = userEvent.setup();
		const onRecheck = vi.fn();
		const { container } = render(ServiceDetail, {
			props: { service: baseService, history: [], onRecheck, messages: testMessages },
		});
		const btn = container.querySelector('button[aria-label="Recheck now"]') as
			| HTMLButtonElement
			| null;
		expect(btn).not.toBeNull();
		await user.click(btn as HTMLButtonElement);
		expect(onRecheck).toHaveBeenCalledOnce();
	});

	it('does not render the Recheck button when onRecheck is omitted', () => {
		const { container } = render(ServiceDetail, {
			props: { service: baseService, history: [], messages: testMessages },
		});
		expect(container.querySelector('button[aria-label="Recheck now"]')).toBeNull();
	});
});
