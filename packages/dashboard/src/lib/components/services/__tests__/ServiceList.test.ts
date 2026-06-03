/**
 * ServiceList.test.ts — exercises the table view's column rendering
 * (name, category, status badge, response, uptime) and the empty
 * state.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '../../../utils/test-render';
import ServiceList from '../ServiceList.svelte';
import { FROZEN_NOW } from '../../../mocks/fixtures/seed';
import { adaptService } from '../adapter';
import type { Service } from '@cortexos/contracts';

type MockInput = Parameters<typeof adaptService>[0];

function makeService(overrides: Partial<MockInput> = {}): Service {
	return adaptService({
		id: 'svc_list',
		slug: 'listsvc',
		name: 'List Service',
		description: '',
		category: 'Database',
		status: 'online',
		responseTime: 50,
		iconColor: null,
		iconImage: null,
		openUrl: null,
		healthUrl: 'https://x',
		healthType: 'http',
		kind: 'app',
		envSource: null,
		isActive: true,
		hasWebui: false,
		showInHealthcheck: true,
		showInWebui: true,
		sortOrder: 0,
		iconType: 'lucide',
		badges: [],
		createdAt: FROZEN_NOW,
		updatedAt: FROZEN_NOW,
		...overrides,
	} as MockInput);
}

describe('ServiceList', () => {
	afterEach(cleanup);

	it('renders one row per service', () => {
		const services = [
			makeService(),
			makeService({ slug: 'b', name: 'B' } as Partial<MockInput>),
		];
		const { container } = render(ServiceList, { props: { services } });
		const rows = container.querySelectorAll('tbody [data-slot="table-row"]');
		expect(rows.length).toBe(2);
	});

	it('renders the column headers', () => {
		const { container } = render(ServiceList, {
			props: { services: [makeService()] },
		});
		expect(container.textContent).toContain('Name');
		expect(container.textContent).toContain('Category');
		expect(container.textContent).toContain('Status');
		expect(container.textContent).toContain('Response');
		expect(container.textContent).toContain('Uptime 24h');
	});

	it('renders the status badge for each row', () => {
		const services = [
			makeService(),
			makeService({ status: 'offline' } as Partial<MockInput>),
		];
		const { container } = render(ServiceList, { props: { services } });
		const badges = container.querySelectorAll('[data-slot="service-health-badge"]');
		expect(badges.length).toBeGreaterThanOrEqual(2);
	});

	it('shows the DataTable empty state when there are no rows', () => {
		const { container } = render(ServiceList, { props: { services: [] } });
		expect(container.textContent).toContain('No results');
	});

	it('paginates with a small page size', () => {
		const services = Array.from({ length: 6 }, () => makeService());
		const { container } = render(ServiceList, {
			props: { services, pageSize: 2 },
		});
		expect(container.textContent).toContain('Page 1 / 3');
	});
});
