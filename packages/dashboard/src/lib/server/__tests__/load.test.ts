/**
 * load.test.ts — paginatedLoad + LoadError.
 */

import { describe, it, expect } from 'vitest';
import { paginatedLoad, LoadError } from '../load';
import { z } from 'zod';
import { makeFakeEvent } from '../test-utils';

const PageInputSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(200).default(25),
  sort: z.string().min(1).max(64).optional(),
  dir: z.enum(['asc', 'desc']).optional(),
  filter: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
});

describe('paginatedLoad', () => {
  it('returns a Page<T> with items + total + hasMore', async () => {
    const handler = paginatedLoad(PageInputSchema, async (input) => {
      const total = 50;
      const items = Array.from({ length: input.pageSize }, (_, i) => ({
        idx: (input.page - 1) * input.pageSize + i,
      }));
      return { items, total };
    });
    const event = makeFakeEvent({ url: 'http://localhost/?page=1&pageSize=10' });
    const page = await handler(event);
    expect(page.items).toHaveLength(10);
    expect(page.total).toBe(50);
    expect(page.page).toBe(1);
    expect(page.pageSize).toBe(10);
    expect(page.hasMore).toBe(true);
  });

  it('handles defaults when no params', async () => {
    const handler = paginatedLoad(PageInputSchema, async (input) => {
      return { items: [], total: 0 };
    });
    const event = makeFakeEvent({ url: 'http://localhost/' });
    const page = await handler(event);
    expect(page.page).toBe(1);
    expect(page.pageSize).toBe(25);
  });

  it('throws LoadError on bad pageSize', async () => {
    const handler = paginatedLoad(PageInputSchema, async () => ({ items: [], total: 0 }));
    const event = makeFakeEvent({ url: 'http://localhost/?pageSize=999' });
    await expect(handler(event)).rejects.toThrow(LoadError);
    try {
      await handler(makeFakeEvent({ url: 'http://localhost/?pageSize=999' }));
    } catch (e) {
      expect((e as LoadError).status).toBe(400);
    }
  });

  it('hasMore is false on the last page', async () => {
    const handler = paginatedLoad(PageInputSchema, async (input) => {
      const total = 25;
      const items = Array.from({ length: input.pageSize }, (_, i) => ({
        idx: (input.page - 1) * input.pageSize + i,
      })).filter((it) => it.idx < total);
      return { items, total };
    });
    const event = makeFakeEvent({ url: 'http://localhost/?page=1&pageSize=25' });
    const page = await handler(event);
    expect(page.hasMore).toBe(false);
  });

  it('parses filter.* query params', async () => {
    const handler = paginatedLoad(PageInputSchema, async (input) => {
      expect(input.filter).toEqual({ status: 'active' });
      return { items: [], total: 0 };
    });
    const event = makeFakeEvent({ url: 'http://localhost/?filter.status=active' });
    await handler(event);
  });
});
