import type { LayoutServerLoad } from './$types';
import { DEFAULT_MODE, DEFAULT_PRESET, LOCALE_COOKIE, MODE_COOKIE, PRESET_COOKIE, isMode, isPreset } from '$lib/theme-presets';
import { getMessages, resolveLocale } from '$lib/i18n';

export const load: LayoutServerLoad = ({ cookies, request, locals }) => {
	const presetCookie = cookies.get(PRESET_COOKIE);
	const modeCookie = cookies.get(MODE_COOKIE);
	const localeCookie = cookies.get(LOCALE_COOKIE);

	const theme = {
		preset: isPreset(presetCookie) ? presetCookie : DEFAULT_PRESET,
		mode: isMode(modeCookie) ? modeCookie : DEFAULT_MODE
	};

	const acceptLanguage = request.headers.get('accept-language');
	const locale = resolveLocale({
		query: null,
		cookie: localeCookie,
		acceptLanguage
	});

	const messages = getMessages(locale);

	return {
		theme,
		locale,
		messages,
		user: locals.user
	};
};
