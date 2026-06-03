/**
 * Pagination / filter / sort conventions.
 *
 * Source: the E2E coverage matrix (table sorting on every page, page
 * sizes 25/50/100, server-side filtering by name/status/etc).
 */

import { z } from 'zod';

export const sortDirSchema = z.enum(['asc', 'desc']);
export type SortDir = z.infer<typeof sortDirSchema>;

export const pageInputSchema = z.object({
	page: z.number().int().positive().default(1),
	pageSize: z.number().int().positive().max(500).default(50),
	search: z.string().optional(),
	sortBy: z.string().optional(),
	sortDir: sortDirSchema.default('asc'),
});
export type PageInput = z.infer<typeof pageInputSchema>;

export function pageInputWithDefaults<T extends z.ZodTypeAny>(item: T) {
	return z.object({
		page: z.number().int().positive().default(1),
		pageSize: z.number().int().positive().max(500).default(50),
		total: z.number().int().nonnegative(),
		items: z.array(item),
	});
}

export interface Page<T> {
	items: T[];
	total: number;
	page: number;
	pageSize: number;
}

export function paginate<T>(items: T[], input: PageInput): Page<T> {
	const filtered = input.search
		? items.filter((i) => JSON.stringify(i).toLowerCase().includes(input.search!.toLowerCase()))
		: items;
	const sorted =
		input.sortBy && (filtered as unknown as Record<string, unknown>[]).length
			? [...filtered].sort((a, b) => {
					const av = (a as unknown as Record<string, unknown>)[input.sortBy!];
					const bv = (b as unknown as Record<string, unknown>)[input.sortBy!];
					if (typeof av === 'number' && typeof bv === 'number') {
						return input.sortDir === 'asc' ? av - bv : bv - av;
					}
					const as = String(av ?? '');
					const bs = String(bv ?? '');
					return input.sortDir === 'asc' ? as.localeCompare(bs) : bs.localeCompare(as);
				})
			: filtered;
	const start = (input.page - 1) * input.pageSize;
	return {
		items: sorted.slice(start, start + input.pageSize),
		total: filtered.length,
		page: input.page,
		pageSize: input.pageSize,
	};
}
