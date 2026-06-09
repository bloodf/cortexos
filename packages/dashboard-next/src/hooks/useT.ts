import { useUI } from "./useUI";
import { getDict } from "@/i18n";

export function useLocale() { return useUI().locale; }
export function useT() { return getDict(useUI().locale); }
