/**
 * Run `fn` over `items` sequentially (order-preserving), collecting
 * results.  Implemented as a reduce-chain so the body is lint-clean
 * (no `await` inside a loop construct).
 */
export async function runSequentially<T, R>(
  items: readonly T[],
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  await items.reduce<Promise<void>>(
    (chain, item, index) => chain.then(() => fn(item, index).then((r) => { results.push(r); })),
    Promise.resolve(),
  );
  return results;
}
