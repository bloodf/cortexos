import { describe, expect, it } from 'vitest';
import { WIDGET_REGISTRY, WIDGET_LABELS } from '../dashboard-widgets';

describe('WIDGET_REGISTRY', () => {
	it('contains all 17 widget entries', () => {
		expect(Object.keys(WIDGET_REGISTRY).length).toBe(17);
	});

	it('maps widget keys to React components', () => {
		for (const [, Component] of Object.entries(WIDGET_REGISTRY)) {
			expect(typeof Component).toBe('function');
		}
	});

	it('has matching keys in WIDGET_LABELS', () => {
		for (const key of Object.keys(WIDGET_REGISTRY)) {
			expect(WIDGET_LABELS[key]).toBeDefined();
			expect(typeof WIDGET_LABELS[key]).toBe('string');
		}
	});

	const expectedWidgets = [
		'cpu-gauge', 'memory-gauge', 'storage-gauge',
		'service-online', 'service-offline', 'service-idle',
		'live-performance', 'top-processes', 'network-graph',
		'total-download', 'total-upload',
		'database-ops', 'monitoring-ops', 'container-ops',
		'docker-status', 'uptime', 'alerts',
	];
	it.each(expectedWidgets)('contains widget "%s"', (key) => {
		expect(WIDGET_REGISTRY[key]).toBeDefined();
	});
});

describe('WIDGET_LABELS', () => {
	it('contains all 17 label entries', () => {
		expect(Object.keys(WIDGET_LABELS).length).toBe(17);
	});

	it('has human-readable labels', () => {
		expect(WIDGET_LABELS['cpu-gauge']).toBe('CPU');
		expect(WIDGET_LABELS['memory-gauge']).toBe('Memory');
		expect(WIDGET_LABELS['live-performance']).toBe('Live Performance');
		expect(WIDGET_LABELS['database-ops']).toBe('Database Ops');
	});
});
