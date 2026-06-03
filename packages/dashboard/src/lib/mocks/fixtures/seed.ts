/**
 * Deterministic seed for `@faker-js/faker`.
 *
 * The M0-F test strategy §7.3 forbids non-deterministic randomness in
 * the test data plane. Every fixture call funnels through `seed()`
 * once on module load — `faker.seed(42)` is the literal value; do
 * not "improve" it without bumping the matrix's documented seed.
 *
 * If a single test needs isolated randomness (it shouldn't), the test
 * can call `withFakerSeed(seedValue, fn)` to temporarily scope a
 * different seed.
 */

import { faker, Faker, en, base } from '@faker-js/faker';

const DEFAULT_SEED = 42;
let currentSeed = DEFAULT_SEED;

export const DEFAULT_TEST_SEED = DEFAULT_SEED;

/**
 * Module-level counter shared by all factories that mint IDs. Reset
 * whenever a new faker seed is applied so the data plane is fully
 * deterministic (TEST_STRATEGY §7.3 — "same seed → same fixtures").
 */
let idCounter = 0;

/** Reset the shared id counter. Called automatically by `seedFaker`. */
export function resetIdCounter(): void {
	idCounter = 0;
}

/** Current value of the shared id counter. Exposed for tests. */
export function getIdCounter(): number {
	return idCounter;
}

/** Bump the shared id counter; returns the next value. */
export function nextIdValue(): number {
	return ++idCounter;
}

/** Initialise the singleton faker with a stable seed. Idempotent. */
export function seedFaker(seedValue: number = DEFAULT_SEED): void {
	faker.seed(seedValue);
	currentSeed = seedValue;
	resetIdCounter();
}

/** Run `fn` with a one-off seed; restores the global seed after. */
export function withFakerSeed<T>(seedValue: number, fn: () => T): T {
	const previous = currentSeed;
	const previousCount = idCounter;
	faker.seed(seedValue);
	resetIdCounter();
	try {
		return fn();
	} finally {
		faker.seed(previous);
		idCounter = previousCount;
	}
}

/** Alias to match the original public API. */
export { faker as fakerInstance };

/** A fresh, isolated faker instance with the default seed. */
export function makeFaker(seedValue: number = DEFAULT_SEED): Faker {
	const f = new Faker({ locale: [en, base] });
	f.seed(seedValue);
	return f;
}

// Seed on module load. Anything that imports `@/lib/mocks/fixtures/*`
// after this point will see a deterministic faker.
seedFaker();

/** A frozen ISO timestamp used for fixed-date fixtures. */
export const FROZEN_NOW = '2026-06-03T13:00:00.000Z';

/** Computed offsets from FROZEN_NOW (no Date.now() in fixtures). */
export const FROZEN_NOW_EPOCH = Date.parse(FROZEN_NOW);
