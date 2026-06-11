/**
 * Sequential array processor.
 *
 * Implemented as a reduce-chain so it stays lint-clean under
 * `no-restricted-syntax` (no `for...of` loops). Ordering is preserved by
 * construction because each item is awaited before the next begins.
 *
 * @template T, U
 * @param {T[]} items
 * @param {(acc: U, item: T, index: number) => U | Promise<U>} iteratee
 * @param {U} initialAcc
 * @returns {Promise<U>}
 */
export default async function runSequentially(items, iteratee, initialAcc) {
  return items.reduce(async (accPromise, item, index) => {
    const acc = await accPromise;
    return iteratee(acc, item, index);
  }, Promise.resolve(initialAcc));
}
