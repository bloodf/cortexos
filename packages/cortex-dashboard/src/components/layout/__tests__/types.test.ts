import { describe, expect, it } from 'vitest';
import type { LayoutRow, LayoutConfig } from '../types';

describe('Layout types', () => {
	it('LayoutRow has items array', () => {
		const row: LayoutRow = { items: ['cpu-gauge', 'memory-gauge'] };
		expect(row.items).toHaveLength(2);
		expect(row.items[0]).toBe('cpu-gauge');
	});

	it('LayoutConfig has rows array', () => {
		const config: LayoutConfig = {
			rows: [
				{ items: ['cpu-gauge', 'memory-gauge'] },
				{ items: ['live-performance'] },
			],
		};
		expect(config.rows).toHaveLength(2);
		expect(config.rows[0].items).toContain('cpu-gauge');
	});

	it('supports empty layout', () => {
		const config: LayoutConfig = { rows: [] };
		expect(config.rows).toHaveLength(0);
	});

	it('supports empty item rows', () => {
		const config: LayoutConfig = { rows: [{ items: [] }] };
		expect(config.rows[0].items).toHaveLength(0);
	});
});
