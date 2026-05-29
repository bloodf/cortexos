"use client";

import {
	ThemeProvider as NextThemesProvider,
	useTheme as useNextTheme,
} from "next-themes";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";

/* ============================================================================
   Theming = two independent concerns:
     - mode    : light | dark | system  (managed by next-themes, attribute="class")
     - preset  : brand accent class on <html> (theme-cortex|teal|emerald|amber),
                 persisted in a cookie so SSR can apply it without a flash.
   ========================================================================== */

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
/** CSS class applied to <html> for a given preset: `theme-<preset>`. */
export const presetClass = (preset: ThemePreset) => `theme-${preset}`;

const PRESET_CLASSES = PRESETS.map(presetClass);
const PRESET_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

function isPreset(value: string | null | undefined): value is ThemePreset {
	return value != null && (PRESETS as readonly string[]).includes(value);
}

function readPresetCookie(): ThemePreset {
	if (typeof document === "undefined") return DEFAULT_PRESET;
	const match = document.cookie.match(
		new RegExp(`(?:^|; )${PRESET_COOKIE}=([^;]*)`),
	);
	const value = match ? decodeURIComponent(match[1]) : null;
	return isPreset(value) ? value : DEFAULT_PRESET;
}

/* ---------------------------------------------------------------------------
   Preset context (companion to next-themes).
   --------------------------------------------------------------------------- */

interface PresetContextValue {
	preset: ThemePreset;
	setPreset: (preset: ThemePreset) => void;
}

const PresetContext = createContext<PresetContextValue | undefined>(undefined);

function PresetProvider({
	children,
	initialPreset,
}: {
	children: React.ReactNode;
	initialPreset?: ThemePreset;
}) {
	const [preset, setPresetState] = useState<ThemePreset>(
		() => initialPreset ?? readPresetCookie(),
	);

	// Keep <html> class + cookie in sync with the selected preset.
	useEffect(() => {
		const html = document.documentElement;
		html.classList.remove(...PRESET_CLASSES);
		html.classList.add(presetClass(preset));
		document.cookie = `${PRESET_COOKIE}=${preset}; path=/; max-age=${PRESET_COOKIE_MAX_AGE}; samesite=lax`;
	}, [preset]);

	const setPreset = useCallback((next: ThemePreset) => {
		setPresetState(next);
	}, []);

	const value = useMemo<PresetContextValue>(
		() => ({ preset, setPreset }),
		[preset, setPreset],
	);

	return (
		<PresetContext.Provider value={value}>{children}</PresetContext.Provider>
	);
}

/* ---------------------------------------------------------------------------
   Public ThemeProvider — wraps next-themes (mode) + preset companion.
   --------------------------------------------------------------------------- */

export function ThemeProvider({
	children,
	initialPreset,
}: {
	children: React.ReactNode;
	initialPreset?: ThemePreset;
}) {
	return (
		<NextThemesProvider
			attribute="class"
			defaultTheme="dark"
			enableSystem
			disableTransitionOnChange
		>
			<PresetProvider initialPreset={initialPreset}>{children}</PresetProvider>
		</NextThemesProvider>
	);
}

/* ---------------------------------------------------------------------------
   Hooks.
   --------------------------------------------------------------------------- */

interface UseThemeValue {
	/** Active mode preference (light | dark | system). */
	theme: ThemeMode;
	/** Resolved mode after applying `system` (light | dark). */
	resolvedTheme: "light" | "dark" | undefined;
	setTheme: (mode: ThemeMode) => void;
	/** Toggle between light and dark based on the resolved mode. */
	toggleTheme: () => void;
}

/**
 * Mode get/set/toggle. Thin wrapper over next-themes so existing consumers
 * (ThemeSwitcher, terminal, sonner) keep working with `{ theme, setTheme,
 * toggleTheme }`.
 */
export function useTheme(): UseThemeValue {
	const { theme, setTheme, resolvedTheme } = useNextTheme();

	const toggleTheme = useCallback(() => {
		const current = resolvedTheme ?? theme;
		setTheme(current === "dark" ? "light" : "dark");
	}, [resolvedTheme, theme, setTheme]);

	return {
		theme: (theme as ThemeMode) ?? "system",
		resolvedTheme: resolvedTheme as "light" | "dark" | undefined,
		setTheme: setTheme as (mode: ThemeMode) => void,
		toggleTheme,
	};
}

/** Preset (brand accent) get/set. */
export function usePreset(): PresetContextValue {
	const context = useContext(PresetContext);
	if (!context) {
		throw new Error("usePreset must be used within a ThemeProvider");
	}
	return context;
}
