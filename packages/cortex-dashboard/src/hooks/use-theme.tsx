"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
	theme: Theme;
	setTheme: (theme: Theme) => void;
	toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = "cortex-theme";

function readStoredTheme(): Theme {
	if (typeof window === "undefined") return "dark";
	const stored = localStorage.getItem(STORAGE_KEY);
	return stored === "light" || stored === "dark" ? stored : "dark";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
	const [theme, setThemeState] = useState<Theme>(() => readStoredTheme());

	// Apply theme class to <html> (effect only runs in the browser).
	useEffect(() => {
		const html = document.documentElement;
		html.classList.remove("light", "dark");
		html.classList.add(theme);
		localStorage.setItem(STORAGE_KEY, theme);
	}, [theme]);

	const setTheme = useCallback((t: Theme) => {
		setThemeState(t);
	}, []);

	const toggleTheme = useCallback(() => {
		setThemeState((prev) => (prev === "dark" ? "light" : "dark"));
	}, []);

	return (
		<ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
			{children}
		</ThemeContext.Provider>
	);
}

export function useTheme() {
	const context = useContext(ThemeContext);
	if (!context) {
		throw new Error("useTheme must be used within a ThemeProvider");
	}
	return context;
}
