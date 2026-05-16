import { describe, expect, it } from 'vitest';
import { fuzzyMatch, CATEGORIES } from '../types';

describe('fuzzyMatch', () => {
	it('returns true for empty query', () => {
		expect(fuzzyMatch('', 'anything')).toBe(true);
	});

	it('matches exact text', () => {
		expect(fuzzyMatch('grafana', 'grafana')).toBe(true);
	});

	it('matches case-insensitively', () => {
		expect(fuzzyMatch('GRAFANA', 'grafana')).toBe(true);
		expect(fuzzyMatch('grafana', 'GRAFANA')).toBe(true);
	});

	it('matches fuzzy subsequence', () => {
		expect(fuzzyMatch('gfn', 'grafana')).toBe(true);
	});

	it('returns false for non-matching text', () => {
		expect(fuzzyMatch('xyz', 'grafana')).toBe(false);
	});

	it('ignores whitespace in query and text', () => {
		expect(fuzzyMatch('home assistant', 'Home Assistant')).toBe(true);
	});

	it('handles single character queries', () => {
		expect(fuzzyMatch('g', 'grafana')).toBe(true);
		expect(fuzzyMatch('z', 'grafana')).toBe(false);
	});
});

describe('CATEGORIES', () => {
	it('starts with "All"', () => {
		expect(CATEGORIES[0]).toBe('All');
	});

	it('contains common categories', () => {
		expect(CATEGORIES).toContain('Infrastructure');
		expect(CATEGORIES).toContain('Database');
		expect(CATEGORIES).toContain('Monitoring');
	});

	it('has correct total count', () => {
		expect(CATEGORIES.length).toBe(9);
	});
});
