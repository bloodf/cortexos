/**
 * Theme presets — pure constants/types, shared by the SSR layout, the
 * client theme switcher, and the no-flash inline script in `app.html`.
 * Mirrors the legacy `packages/dashboard/src/lib/theme-presets.ts` so the
 * cookie name + value set stay in lockstep.
 */

export type ThemeMode = 'light' | 'dark' | 'system';
export type ThemePreset = 'cortex' | 'teal' | 'emerald' | 'amber';

export const PRESETS: readonly ThemePreset[] = [
	'cortex',
	'teal',
	'emerald',
	'amber'
] as const;

export const DEFAULT_PRESET: ThemePreset = 'cortex';
export const DEFAULT_MODE: ThemeMode = 'system';

/** Cookie name read by the no-flash inline script in the root layout. */
export const PRESET_COOKIE = 'cortex-preset';
export const MODE_COOKIE = 'cortex-mode';
export const LOCALE_COOKIE = 'cortex-locale';

export const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

/** CSS class applied to <html> for a given preset: `theme-<preset>`. */
export const presetClass = (preset: ThemePreset): string => `theme-${preset}`;

export const PRESET_CLASSES: readonly string[] = PRESETS.map(presetClass);

export function isPreset(value: string | null | undefined): value is ThemePreset {
	return value != null && (PRESETS as readonly string[]).includes(value);
}

export function isMode(value: string | null | undefined): value is ThemeMode {
	return value === 'light' || value === 'dark' || value === 'system';
}
