import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// jsdom does not implement these — stub them so the components do not crash.
if (typeof window !== 'undefined') {
  // matchMedia
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
      dispatchEvent: vi.fn(),
    })),
  });

  // ResizeObserver (used by some overlays)
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (window as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverMock;

  // scrollTo
  window.scrollTo = vi.fn();

  // Element.scrollIntoView
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = vi.fn();
  }
}
