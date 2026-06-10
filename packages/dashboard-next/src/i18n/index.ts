import { en, type Dict } from "./en";
import { es } from "./es";
import { ptBR } from "./ptBR";

export type Locale = "en" | "es" | "pt-br";
export const LOCALES: Locale[] = ["en", "es", "pt-br"];

const dicts: Record<Locale, Dict> = { en, es, "pt-br": ptBR };

export function isLocale(s: string | undefined): s is Locale {
  return !!s && (LOCALES as string[]).includes(s);
}

export function getDict(locale: Locale): Dict {
  return dicts[locale];
}

export const LOCALE_LABEL: Record<Locale, string> = {
  en: "English",
  es: "Español",
  "pt-br": "Português (BR)",
};
