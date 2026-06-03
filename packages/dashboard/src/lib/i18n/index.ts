/**
 * i18n — JSON-based, SvelteKit-native.
 *
 * Conventions:
 *   - Locales: `en` (complete), `es` (stub), `pt-br` (stub).
 *   - Translation lookup: `t('app.shell.title')` returns the leaf string.
 *   - No ICU / plural / interpolation in v1; add when a copywriter
 *     needs it. Strings are static; safe to embed in a map.
 *   - The locale cookie is `cortex-locale` (per `theme-presets.ts`).
 *   - Resolution order: `?lang=` query → `cortex-locale` cookie →
 *     `accept-language` header → `defaultLocale` (`en`).
 *
 * The actual switcher UI lives in `src/lib/components/i18n/LocaleSwitcher.svelte`.
 * The router does NOT use SvelteKit's locale segment; we keep the URL
 * locale-agnostic to match the audit's recommendation (F-6 / §8.15).
 */

import en from './messages/en.json';
import es from './messages/es.json';
import ptBr from './messages/pt-br.json';

export const LOCALES = ['en', 'es', 'pt-br'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

export const LOCALE_LABELS: Record<Locale, string> = {
	en: 'English',
	es: 'Español',
	'pt-br': 'Português (Brasil)'
};

export type Messages = typeof en;
export type MessageKey = keyof Messages;

const MESSAGES: Record<Locale, Messages> = {
	en,
	es,
	'pt-br': ptBr
};

function isLocale(value: string | null | undefined): value is Locale {
	return value != null && (LOCALES as readonly string[]).includes(value);
}

export function resolveLocale(input: {
	query?: string | null;
	cookie?: string | null;
	acceptLanguage?: string | null;
}): Locale {
	if (isLocale(input.query)) return input.query;
	if (isLocale(input.cookie)) return input.cookie;
	const accept = input.acceptLanguage ?? '';
	for (const part of accept.split(',')) {
		const tag = part.split(';')[0]?.trim().toLowerCase() ?? '';
		if (isLocale(tag)) return tag;
		// language-only match: `pt` → `pt-br`
		if (tag === 'pt') return 'pt-br';
		if (tag === 'en') return 'en';
		if (tag === 'es') return 'es';
	}
	return DEFAULT_LOCALE;
}

export function getMessages(locale: Locale): Messages {
	return MESSAGES[locale] ?? MESSAGES[DEFAULT_LOCALE];
}

/**
 * Leaf-path lookup. `t(messages, 'app.shell.title')` → `"CortexOS"`.
 * Falls back to the dotted key (visible to the developer) when the
 * translation is missing — never returns `undefined`.
 */
export function t(messages: Messages, path: string): string {
	const segments = path.split('.');
	let cursor: unknown = messages;
	for (const seg of segments) {
		if (cursor != null && typeof cursor === 'object' && seg in cursor) {
			cursor = (cursor as Record<string, unknown>)[seg];
		} else {
			return path;
		}
	}
	return typeof cursor === 'string' ? cursor : path;
}
