/**
 * src/lib/utils.ts — backward-compatible barrel for code that imports from
 * the legacy path (`$lib/utils`).
 *
 * The actual implementations live in `./utils/cn.ts` and `./utils/tv.ts`.
 * This file re-exports them directly (not through `./utils/index.ts`) to
 * avoid a TypeScript circular alias warning.
 */
export { cn, formatBytes } from './utils/cn';
export { tv, type TvConfig, type TvReturn, type VariantsSchema, type VariantRecord } from './utils/tv';
