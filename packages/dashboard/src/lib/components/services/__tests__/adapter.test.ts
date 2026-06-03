/**
 * adapter.test.ts — exercises the mock → contracts `Service`
 * bridge. The adapter is the only place that knows the rename
 * rules (responseTime → responseMs, svc_NNNN → UUID v4) so the
 * assertions here are the safety net.
 */
import { describe, it, expect } from 'vitest';
import {
	adaptService,
	adaptServiceList,
	adaptHealthSnapshot,
	adaptHealthSnapshotList,
	uniqueCategories,
} from '../adapter';
import type {
	Service as MockService,
	ServiceHealthSnapshot as MockSnapshot,
} from '$lib/mocks/contracts/entities/service';
import { FROZEN_NOW } from '../../../mocks/fixtures/seed';

/**
 * Build a mock service literal cast to the branded `MockService`
 * shape. The brand-constructors are no-ops for these tests, but TS
 * requires the id to satisfy the `ServiceId` brand.
 */
function mockSvc(overrides: Partial<MockService> = {}): MockService {
	return {
		id: 'svc_0001' as MockService['id'],
		slug: 'grafana',
		name: 'Grafana',
		description: 'Dashboards',
		category: 'Monitoring',
		status: 'online',
		responseTime: 42,
		iconColor: '#34d399',
		iconImage: null,
		openUrl: 'https://grafana.local',
		healthUrl: 'https://grafana.local/healthz',
		healthType: 'http',
		kind: 'docker',
		envSource: null,
		isActive: true,
		hasWebui: true,
		showInHealthcheck: true,
		showInWebui: true,
		sortOrder: 10,
		iconType: 'mono',
		badges: [{ slug: 'new', label: 'New', color: '#0ea5e9' }],
		createdAt: FROZEN_NOW,
		updatedAt: FROZEN_NOW,
		...overrides,
	};
}

function mockSnap(overrides: Partial<MockSnapshot> = {}): MockSnapshot {
	return {
		id: 'snap_0001' as MockSnapshot['id'],
		serviceId: 'svc_0001' as MockSnapshot['serviceId'],
		status: 'online',
		latencyMs: 17,
		checkedAt: FROZEN_NOW,
		...overrides,
	};
}

describe('adapter — mock → contracts', () => {
	it('adaptService maps a happy-path mock Service', () => {
		const out = adaptService(mockSvc());
		expect(out.slug).toBe('grafana');
		expect(out.name).toBe('Grafana');
		expect(out.status).toBe('online');
		expect(out.responseMs).toBe(42);
		expect(out.kind).toBe('docker');
		expect(out.healthType).toBe('http');
		expect(out.icon?.type).toBe('monogram');
		expect(out.icon?.color).toBe('#34d399');
		expect(out.badges).toHaveLength(1);
		expect(out.badges[0]?.slug).toBe('new');
	});

	it('adaptService returns null responseMs for zero responseTime (no probe yet)', () => {
		const out = adaptService(mockSvc({ responseTime: 0 }));
		expect(out.responseMs).toBeNull();
	});

	it('adaptService maps iconType=image to icon.type=image', () => {
		const out = adaptService(
			mockSvc({
				slug: 'a',
				name: 'A',
				category: 'AI',
				iconType: 'image',
				iconColor: null,
				iconImage: 'data:image/png;base64,abc',
			}),
		);
		expect(out.icon?.type).toBe('image');
		expect(out.icon?.image).toBe('data:image/png;base64,abc');
	});

	it('adaptService yields a stable UUID across calls for the same id', () => {
		const a = adaptService(mockSvc({ id: 'svc_7777' as MockService['id'] }));
		const b = adaptService(mockSvc({ id: 'svc_7777' as MockService['id'] }));
		expect(a.id).toBe(b.id);
		expect(a.id).toMatch(/^[0-9a-f-]{36}$/);
	});

	it('adaptServiceList handles empty arrays', () => {
		expect(adaptServiceList([])).toEqual([]);
	});

	it('adaptHealthSnapshot maps the mock snapshot shape', () => {
		const out = adaptHealthSnapshot(mockSnap());
		expect(out.status).toBe('online');
		expect(out.latencyMs).toBe(17);
		expect(out.checkedAt).toBe(FROZEN_NOW);
		expect(out.id).toMatch(/^[0-9a-f-]{36}$/);
	});

	it('adaptHealthSnapshot handles null latencyMs (probe failed before timing)', () => {
		const out = adaptHealthSnapshot(mockSnap({ latencyMs: 0 as unknown as number }));
		// Adapter keeps 0 as 0 (the mock type is `number` not
		// `number | null`), so this asserts the shape is preserved.
		expect(out.latencyMs).toBe(0);
	});

	it('adaptHealthSnapshotList maps many', () => {
		const out = adaptHealthSnapshotList([
			mockSnap({ id: 's1' as MockSnapshot['id'] }),
			mockSnap({ id: 's2' as MockSnapshot['id'], status: 'offline' }),
		]);
		expect(out).toHaveLength(2);
		expect(out[1]?.status).toBe('offline');
	});

	it('uniqueCategories returns sorted unique categories', () => {
		const services = adaptServiceList([
			mockSvc({ id: 'a' as MockService['id'], slug: 'a', category: 'Database', kind: 'docker' }),
			mockSvc({ id: 'b' as MockService['id'], slug: 'b', category: 'AI', kind: 'app' }),
			mockSvc({ id: 'c' as MockService['id'], slug: 'c', category: 'AI', kind: 'app' }),
		]);
		const cats = uniqueCategories(services);
		expect(cats).toEqual(['AI', 'Database']);
	});
});
