/* Pure theme constants/types — NO "use client".
   Shared by the client theme provider (use-theme.tsx) and server components
   (root layout reads the preset cookie at SSR). Keeping these out of the
   "use client" module avoids the server importing a client-reference proxy
   instead of the real array (which broke `PRESETS.includes`). */

export type ThemeMode = "light" | "dark" | "system";
export type ThemePreset = "cortex" | "teal" | "emerald" | "amber";

export const PRESETS: readonly ThemePreset[] = [
	"cortex",
	"teal",
	"emerald",
	"amber",
] as const;

export const DEFAULT_PRESET: ThemePreset = "cortex";

/** Cookie name read by the no-flash inline script in the root layout. */
export const PRESET_COOKIE = "cortex-preset";
export const PRESET_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

/** CSS class applied to <html> for a given preset: `theme-<preset>`. */
export const presetClass = (preset: ThemePreset) => `theme-${preset}`;

export const PRESET_CLASSES = PRESETS.map(presetClass);

export function isPreset(value: string | null | undefined): value is ThemePreset {
	return value != null && (PRESETS as readonly string[]).includes(value);
}
