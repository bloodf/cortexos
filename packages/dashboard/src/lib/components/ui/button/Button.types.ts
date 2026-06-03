/**
 * Public type surface for the Button primitive.
 *
 * Kept in a sibling `.ts` file (not inside the Svelte component) so we can
 * re-export them from `index.ts` without Svelte 5's compiler stripping the
 * type exports. The component imports the types from here.
 */
export type Variant =
  | 'default'
  | 'outline'
  | 'secondary'
  | 'ghost'
  | 'destructive'
  | 'link';

export type Size = 'default' | 'sm' | 'lg' | 'icon';
