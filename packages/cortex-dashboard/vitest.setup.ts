import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Global next-intl mock: return the key verbatim so components that call
// useTranslations() render without a NextIntlClientProvider in unit tests.
vi.mock('next-intl', () => ({
	useTranslations: () => (key: string) => key,
}));
vi.mock('next-intl/server', () => ({
	getTranslations: async () => (key: string) => key,
}));

// Mock matchMedia for jsdom
if (typeof window !== "undefined") {
	Object.defineProperty(window, 'matchMedia', {
		writable: true,
		value: vi.fn().mockImplementation(query => ({
			matches: false,
			media: query,
			onchange: null,
			addListener: vi.fn(),
			removeListener: vi.fn(),
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			dispatchEvent: vi.fn(),
		})),
	});
}
