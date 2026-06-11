/**
 * Run an async function over each item in order, returning the collected
 * results. Implemented with `reduce` so callers avoid `no-await-in-loop` and
 * `no-restricted-syntax` while preserving exact sequential semantics.
 */
export default async function runSequentially<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  return items.reduce<Promise<R[]>>(async (acc, item) => {
    const results = await acc;
    const result = await fn(item);
    return [...results, result];
  }, Promise.resolve([]));
}
