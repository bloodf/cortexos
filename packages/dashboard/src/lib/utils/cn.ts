/**
 * Trivial `cn(...)` helper — class-name composition. Svelte 5 components
 * do not ship a `clsx`+`tailwind-merge` by default; this small helper
 * keeps the call sites concise without pulling a new dependency. We
 * keep the surface intentionally narrow: string-or-falsy. Components
 * with conditional classes build the array and join with spaces.
 */

export type ClassValue = string | number | false | null | undefined;

export function cn(...values: ClassValue[]): string {
	return values.filter(Boolean).join(' ');
}
