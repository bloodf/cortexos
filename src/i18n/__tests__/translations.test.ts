import { describe, expect, it } from 'vitest';
import en from '../../../messages/en.json';
import es from '../../../messages/es.json';
import ptBr from '../../../messages/pt-br.json';

const locales = { en, es, 'pt-br': ptBr };

function getAllKeys(obj: any, prefix = ''): string[] {
	return Object.entries(obj).flatMap(([key, value]) => {
		const path = prefix ? `${prefix}.${key}` : key;
		if (typeof value === 'object' && value !== null) {
			return getAllKeys(value, path);
		}
		return [path];
	});
}

describe('i18n translations', () => {
	const enKeys = getAllKeys(en);

	it('English has all top-level sections', () => {
		expect(Object.keys(en)).toContain('Navigation');
		expect(Object.keys(en)).toContain('Dashboard');
		expect(Object.keys(en)).toContain('Services');
		expect(Object.keys(en)).toContain('Widgets');
	});

	it.each(['es', 'pt-br'])('"%s" has all keys from English', (locale) => {
		const localeKeys = getAllKeys((locales as any)[locale]);
		for (const key of enKeys) {
			expect(localeKeys, `Missing key "${key}" in ${locale}`).toContain(key);
		}
	});

	it.each(['es', 'pt-br'])('"%s" has the same number of keys as English', (locale) => {
		const localeKeys = getAllKeys((locales as any)[locale]);
		expect(localeKeys.length).toBe(enKeys.length);
	});

	it('all translation values are non-empty strings', () => {
		for (const [localeName, localeData] of Object.entries(locales)) {
			const keys = getAllKeys(localeData);
			for (const key of keys) {
				const parts = key.split('.');
				let val: any = localeData;
				for (const part of parts) val = val[part];
				expect(typeof val, `${localeName}.${key} is not a string`).toBe('string');
				expect(val.length, `${localeName}.${key} is empty`).toBeGreaterThan(0);
			}
		}
	});
});
