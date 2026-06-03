/**
 * Load function helper — `paginatedLoad` for SvelteKit `+page.server.ts`
 * load functions.
 *
 * Encapsulates the standard pagination/filter/sort pattern:
 *   1. Validate the query string against a Zod schema (page, pageSize,
 *      sort, dir, filter).
 *   2. Apply pagination/filter/sort to a query function.
 *   3. Return `{ items, total, page, pageSize, hasMore }`.
 *
 * Usage:
 *
 *   import { paginatedLoad } from '$lib/server/load';
 *   import { ServiceListInput } from '$contracts/schemas/services';
 *   import { z } from 'zod';
 *
 *   export const load = paginatedLoad(ServiceListInput, async (input) => {
 *     return db.services.list(input);
 *   });
 */

import { z, type ZodType } from 'zod';
import type { Page, PageInput } from '../entities';
import type { RequestEvent } from '../types';

const SortDirSchema = z.enum(['asc', 'desc']).default('asc');

const PageInputSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
  sort: z.string().min(1).max(64).optional(),
  dir: SortDirSchema.optional(),
  filter: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
    .optional(),
});

/**
 * Query function shape: takes a parsed `PageInput`, returns the items
 * for the requested page plus the total count.
 */
export type QueryFn<T> = (input: PageInput) => Promise<{ items: T[]; total: number }>;

/**
 * Build a SvelteKit load function. Reads `?page=&pageSize=&sort=&dir=&filter=...`
 * from the URL, validates, calls the query, and returns the page.
 *
 * Throws (via SvelteKit's `error()`) on bad input.
 */
export function paginatedLoad<TSchema extends ZodType<PageInput>, TItem>(
  _schema: TSchema,
  query: QueryFn<TItem>,
): (event: RequestEvent) => Promise<Page<TItem>> {
  return async (event: RequestEvent): Promise<Page<TItem>> => {
    const url = event.url;
    const obj: Record<string, unknown> = {};
    for (const [k, v] of url.searchParams.entries()) {
      // Naive multi-value handling — for filter[*] we'd need a different
      // convention. For M1 we accept `?filter.status=active&filter.kind=app`.
      if (k.startsWith('filter.')) {
        const field = k.slice('filter.'.length);
        const filter = (obj.filter as Record<string, string> | undefined) ?? {};
        filter[field] = v;
        obj.filter = filter;
      } else {
        obj[k] = v;
      }
    }

    const parsed = PageInputSchema.safeParse(obj);
    if (!parsed.success) {
      // Surface a 400 to the page. SvelteKit's `error()` is the only way
      // to halt a load function and render the nearest `+error.svelte`.
      const detail = parsed.error.issues
        .map((i) => `${i.path.join('.') || '_root'}: ${i.message}`)
        .join('; ');
      throw new LoadError(400, `Invalid query parameters: ${detail}`);
    }

    const input: PageInput = parsed.data;
    const { items, total } = await query(input);
    const hasMore = input.page * input.pageSize < total;

    return {
      items,
      total,
      page: input.page,
      pageSize: input.pageSize,
      hasMore,
    };
  };
}

// ---------------------------------------------------------------------------
// Lightweight error type for load functions (replaces SvelteKit's `error()`)
// ---------------------------------------------------------------------------

export class LoadError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'LoadError';
  }
}

// ---------------------------------------------------------------------------
// Re-exports
// ---------------------------------------------------------------------------

export { z };
export type { Page, PageInput };
