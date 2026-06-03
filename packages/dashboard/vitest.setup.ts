import { afterEach, expect } from 'vitest';
import { cleanup } from '@testing-library/svelte';
import * as matchers from '@testing-library/jest-dom/matchers';

// testing-library/svelte 5.x does not auto-cleanup between Vitest
// tests; tests that mount via `render` leave their host node in
// `document.body` and the next `screen.getByRole(...)` call sees
// the previous tree. `cleanup()` removes the host node.
afterEach(() => {
	cleanup();
});

// Wire the jest-dom matchers to the Vitest `expect`. The
// `@testing-library/jest-dom/vitest` subpath has been observed to
// fail in Vitest 4 (it re-requires `vitest` from a separate
// module instance, leaving the test-file `expect` un-extended).
// Calling `expect.extend(...)` here, with the same `expect` import
// used by the tests, guarantees the matchers land in the right place.
expect.extend(matchers);
