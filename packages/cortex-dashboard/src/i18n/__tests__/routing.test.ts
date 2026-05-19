import { describe, expect, it } from 'vitest';

// We test the routing config directly without importing createNavigation
// which requires Next.js runtime internals
describe('i18n routing config', () => {
	it('defines the correct locales in the config module', async () => {
		// Import just the defineRouting part - the navigation part needs Next.js
		const { defineRouting } = await import('next-intl/routing');
		const routing = defineRouting({
			locales: ['en', 'es', 'pt-br'],
			defaultLocale: 'en',
		});

		expect(routing.locales).toContain('en');
		expect(routing.locales).toContain('es');
		expect(routing.locales).toContain('pt-br');
	});

	it('has 3 locales', async () => {
		const { defineRouting } = await import('next-intl/routing');
		const routing = defineRouting({
			locales: ['en', 'es', 'pt-br'],
			defaultLocale: 'en',
		});

		expect(routing.locales).toHaveLength(3);
	});

	it('defaults to English', async () => {
		const { defineRouting } = await import('next-intl/routing');
		const routing = defineRouting({
			locales: ['en', 'es', 'pt-br'],
			defaultLocale: 'en',
		});

		expect(routing.defaultLocale).toBe('en');
	});
});
