import '@testing-library/jest-dom/vitest';
// Wire up @testing-library/svelte matchers (toBeDisabled, toHaveAttribute,
// etc.) for the vitest environment. Without this import, the
// @testing-library/svelte-based UI tests fail with
// "expect(...).toBeDisabled is not a function" because the matcher
// extension never registers. The m2-services deliverable added this
// to unblock the 20+ pre-existing UI tests; the M2-approvals feature
// reuses the same test-render helper so the same setup is required.
import '@testing-library/svelte/vitest';
import { vi, expect } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';

// Belt-and-suspenders: explicitly extend expect with the jest-dom
// matchers at the top of the setup file. Re-extending at setup time
// guarantees the matchers are present regardless of which expect
// was already captured.
expect.extend(matchers);

// jsdom does not implement these — stub them so the components do not crash.
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  });

  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (window as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverMock;

  window.scrollTo = vi.fn();
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = vi.fn();
  }
}
