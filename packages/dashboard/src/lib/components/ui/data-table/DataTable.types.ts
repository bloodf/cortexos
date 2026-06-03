/**
 * Public type surface for DataTable.
 *
 * Lives outside the Svelte component so the `export type` declarations are
 * available to other modules (TS cannot re-export `export type` from inside
 * a Svelte component script block).
 */
import type { Snippet } from 'svelte';

export type SortDir = 'asc' | 'desc';

export type Column<T> = {
  key: keyof T & string;
  header: string;
  sortable?: boolean;
  /** Custom cell renderer. Receives (row, rowIndex). */
  cell?: Snippet<[T, number]>;
  /** Custom sort comparator (defaults to < / >). */
  sortFn?: (a: T, b: T) => number;
};
