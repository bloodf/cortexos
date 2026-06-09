import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { type Locale, isLocale } from "@/i18n";

type Theme = "light" | "dark" | "system";
type Accent = "cortex" | "teal" | "emerald" | "amber";

interface UICtx {
  theme: Theme; setTheme: (t: Theme) => void; effective: "light" | "dark";
  accent: Accent; setAccent: (a: Accent) => void;
  locale: Locale; setLocale: (l: Locale) => void;
}

const Ctx = createContext<UICtx | null>(null);
const THEME_KEY = "cortex.theme";
const ACCENT_KEY = "cortex.accent";
const LOCALE_KEY = "cortex.locale";

function resolveTheme(t: Theme): "light" | "dark" {
  if (t !== "system") return t;
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

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
      setThemeState(t); setAccentState(a);
      if (isLocale(l ?? undefined)) setLocaleState(l as Locale);
    } catch { /* noop */ }
  }, []);

  useEffect(() => {
    const eff = resolveTheme(theme);
    setEffective(eff);
    const root = document.documentElement;
    root.classList.toggle("dark", eff === "dark");
    root.setAttribute("data-accent", accent);
    root.style.colorScheme = eff;
  }, [theme, accent]);

  const setTheme = (t: Theme) => { setThemeState(t); try { localStorage.setItem(THEME_KEY, t); } catch { /* noop */ } };
  const setAccent = (a: Accent) => { setAccentState(a); try { localStorage.setItem(ACCENT_KEY, a); } catch { /* noop */ } };
  const setLocale = (l: Locale) => { setLocaleState(l); try { localStorage.setItem(LOCALE_KEY, l); } catch { /* noop */ } };

  return <Ctx.Provider value={{ theme, setTheme, effective, accent, setAccent, locale, setLocale }}>{children}</Ctx.Provider>;
}

export function useUI() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useUI must be used within UIProvider");
  return v;
}

export const ACCENTS: { id: Accent; label: string; color: string }[] = [
  { id: "cortex", label: "Cortex", color: "oklch(0.62 0.19 277)" },
  { id: "teal", label: "Teal", color: "oklch(0.70 0.12 195)" },
  { id: "emerald", label: "Emerald", color: "oklch(0.70 0.15 160)" },
  { id: "amber", label: "Amber", color: "oklch(0.78 0.16 70)" },
];
