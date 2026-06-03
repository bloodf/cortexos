/**
 * CortexOS Design System — barrel re-export.
 *
 * Import design-system primitives from `$lib/components/ui` (the standard
 * shadcn-style pattern) and get the full set in one shot.
 */
export * from './accordion';
export * from './alert';
export * from './badge';
export * from './breadcrumb';
export * from './button';
export * from './card';
export * from './checkbox';
export * from './data-table';
export * from './dialog';
export * from './dropdown-menu';
export * from './empty-state';
export * from './icon-button';
export * from './input';
export * from './label';
export * from './mobile-nav';
export * from './page-header';
export * from './popover';
export * from './progress';
export * from './radio';
export * from './select';
export * from './separator';
export * from './sidebar';
export * from './skeleton';
export * from './slider';
export * from './stat-card';
export * from './switch';
export * from './table';
export * from './tabs';
export * from './textarea';
export * from './toast';
export * from './toast/Toaster.svelte';
export * from './topbar';
export * from './tooltip';

// Utilities
export { cn, tv } from '$lib/utils';
export type { TvConfig, TvReturn, VariantsSchema, VariantRecord } from '$lib/utils';

// Design tokens (CSS) — imported in `src/lib/styles/app.css` and re-exported
// here for tooling that wants to verify the file exists.
export const DESIGN_TOKENS_CSS = 'src/lib/styles/app.css';
