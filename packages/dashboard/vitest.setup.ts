import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/svelte';

// testing-library/svelte 5.x does not auto-cleanup between Vitest
// tests; tests that mount via `render` leave their host node in
// `document.body` and the next `screen.getByRole(...)` call sees
// the previous tree. `cleanup()` removes the host node.
afterEach(() => {
	cleanup();
});
