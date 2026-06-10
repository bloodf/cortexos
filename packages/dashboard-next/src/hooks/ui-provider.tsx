import { useEffect, useState, type ReactNode } from "react";
import { type Locale, isLocale } from "@/i18n";
import {
  UIContext,
  THEME_KEY,
  ACCENT_KEY,
  LOCALE_KEY,
  resolveTheme,
  type Theme,
  type Accent,
} from "./ui-context";

export function UIProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [accent, setAccentState] = useState<Accent>("cortex");
  const [locale, setLocaleState] = useState<Locale>("en");
  const [effective, setEffective] = useState<"light" | "dark">("dark");

  useEffect(() => {
    try {
      const t = (localStorage.getItem(THEME_KEY) as Theme | null) || "dark";
      const a = (localStorage.getItem(ACCENT_KEY) as Accent | null) || "cortex";
      const l = localStorage.getItem(LOCALE_KEY);
      setThemeState(t);
      setAccentState(a);
      if (isLocale(l ?? undefined)) setLocaleState(l as Locale);
    } catch {
      /* noop */
    }
  }, []);

  useEffect(() => {
    const eff = resolveTheme(theme);
    setEffective(eff);
    const root = document.documentElement;
    root.classList.toggle("dark", eff === "dark");
    root.setAttribute("data-accent", accent);
    root.style.colorScheme = eff;
  }, [theme, accent]);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    try {
      localStorage.setItem(THEME_KEY, t);
    } catch {
      /* noop */
    }
  };
  const setAccent = (a: Accent) => {
    setAccentState(a);
    try {
      localStorage.setItem(ACCENT_KEY, a);
    } catch {
      /* noop */
    }
  };
  const setLocale = (l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem(LOCALE_KEY, l);
    } catch {
      /* noop */
    }
  };

  return (
    <UIContext.Provider
      value={{ theme, setTheme, effective, accent, setAccent, locale, setLocale }}
    >
      {children}
    </UIContext.Provider>
  );
}
