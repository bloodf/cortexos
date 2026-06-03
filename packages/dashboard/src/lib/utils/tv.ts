/**
 * tv — typed variant helper (a tiny CVA equivalent in idiomatic Svelte 5).
 *
 *   const button = tv({
 *     base: 'inline-flex rounded-md font-medium',
 *     variants: {
 *       variant: { default: 'bg-primary text-primary-foreground', ghost: 'bg-transparent' },
 *       size:    { sm: 'h-8 px-2', md: 'h-10 px-4', lg: 'h-12 px-6' },
 *     },
 *     defaults: { variant: 'default', size: 'md' },
 *   });
 *
 *   <button class={button({ variant: 'ghost', size: 'sm' })}>...</button>
 *
 * Inspired by `class-variance-authority` (cva) and `tailwind-variants` (tv). We
 * roll our own to:
 *  1) avoid an extra runtime dependency
 *  2) keep the type system simple and fully inferred
 *  3) merge with our `cn()` so conflicting tailwind classes resolve correctly
 */
import { cn } from './cn';

/** A single variant dimension: a record from a key to a class string. */
export type VariantRecord = Record<string, string>;

/** Map of variant name -> record of option -> class string. */
export type VariantsSchema = Record<string, VariantRecord>;

/** Configuration for `tv()`. */
export interface TvConfig<V extends VariantsSchema> {
  /** Base classes always applied. */
  base?: string;
  /** Per-variant class maps. */
  variants?: V;
  /** Default values for each variant (also drives required keys). */
  defaults?: { [K in keyof V]?: keyof V[K] };
  /** Compound variants — `{ variant: x, size: y } -> classes` applied when both match. */
  compoundVariants?: Array<{
    [K in keyof V]?: keyof V[K];
  } & { class: string; className?: never }>;
  /** Default variant values exposed when calling without overrides. */
  defaultVariants?: { [K in keyof V]?: keyof V[K] };
}

/** The callable return value of `tv()`. */
export interface TvReturn<V extends VariantsSchema> {
  (overrides?: {
    [K in keyof V]?: keyof V[K];
  } & { class?: string; className?: string }): string;
}

export function tv<V extends VariantsSchema>(
  config: TvConfig<V>,
): TvReturn<V> {
  const { base = '', variants = {} as V, defaultVariants, defaults, compoundVariants = [] } = config;
  // Accept both `defaults` and `defaultVariants` for ergonomics.
  const resolvedDefaults =
    defaultVariants ?? defaults ?? ({} as { [K in keyof V]?: keyof V[K] });

  return (overrides = {}) => {
    const merged: Record<string, unknown> = { ...resolvedDefaults, ...overrides };
    const classes: string[] = [];

    if (base) classes.push(base);

    for (const variantName of Object.keys(variants)) {
      const value = merged[variantName];
      if (value == null) continue;
      const record = variants[variantName];
      if (record && typeof record === 'object' && value in record) {
        const cls = (record as Record<string, string>)[value as string];
        if (cls) classes.push(cls);
      }
    }

    for (const compound of compoundVariants) {
      const matches = Object.entries(compound).every(([k, v]) => {
        if (k === 'class') return true;
        return merged[k] === v;
      });
      if (matches && compound.class) classes.push(compound.class);
    }

    const userClass = (overrides as { class?: string; className?: string }).class;
    const userClassName = (overrides as { className?: string }).className;
    if (userClass) classes.push(userClass);
    if (userClassName) classes.push(userClassName);

    return cn(...classes);
  };
}
