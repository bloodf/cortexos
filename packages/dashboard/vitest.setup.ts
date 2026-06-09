import '@testing-library/jest-dom/vitest';
// Wire up @testing-library/svelte matchers (toBeDisabled, toHaveAttribute,
// etc.) for the vitest environment. Without this import, the 20+
// pre-existing @testing-library/svelte-based UI tests in
// src/lib/components/ui/ fail with "expect(...).toBeDisabled is not
// a function" because the matcher extension never registers.
import '@testing-library/svelte/vitest';
import { vi, expect } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';

// Belt-and-suspenders: explicitly extend expect with the jest-dom
// matchers at the top of the setup file. Some test files import
// `@testing-library/svelte` which transitively re-evaluates
// `@testing-library/dom`; that path re-binds `expect` from chai.
// Re-extending at setup time guarantees the matchers are present
// regardless of which expect was already captured.
expect.extend(matchers);

// Force M2 stub mode for infrastructure bridges in tests (Linux host would
// otherwise default to real CLI executors and break deterministic tests).
process.env.CORTEX_INCUS_BRIDGE_REAL = '0';
process.env.CORTEX_DOCKER_REAL = '0';


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

  // wterm (@wterm/dom) — requestAnimationFrame is its render scheduler.
  // jsdom does not implement rAF. Modeled on wterm's own
  // packages/@wterm/dom/src/__tests__/setup.ts: route through setTimeout.
  if (typeof (globalThis as { requestAnimationFrame?: unknown }).requestAnimationFrame === 'undefined') {
    (globalThis as unknown as { requestAnimationFrame: (cb: FrameRequestCallback) => number })
      .requestAnimationFrame = (cb: FrameRequestCallback) =>
        setTimeout(() => cb(performance.now()), 0) as unknown as number;
    (globalThis as unknown as { cancelAnimationFrame: (id: number) => void })
      .cancelAnimationFrame = (id: number) => clearTimeout(id);
  }

  // wterm reads --term-row-height / paddingTop / paddingBottom via
  // getComputedStyle on the host element. jsdom returns "" for CSS
  // custom properties; wterm's _lockHeight branch would NaN-out and
  // throw. Stub the values it reads.
  const _origGetComputedStyle = window.getComputedStyle.bind(window);
  window.getComputedStyle = ((el: Element, pseudo?: string | null) => {
    const cs = _origGetComputedStyle(el, pseudo);
    const _get = (prop: string): string => {
      try { return (cs as unknown as { getPropertyValue: (p: string) => string }).getPropertyValue(prop); }
      catch { return ''; }
    };
    return new Proxy(cs, {
      get(target, prop) {
        if (prop === 'getPropertyValue') {
          return (p: string) => {
            const v = _get(p);
            if (v) return v;
            // Defaults wterm's _lockHeight branch expects to read.
            if (p === '--term-row-height') return '17';
            if (p === 'paddingTop') return '0';
            if (p === 'paddingBottom') return '0';
            if (p === 'fontSize') return '13';
            return '';
          };
        }
        return Reflect.get(target, prop);
      },
    });
  }) as typeof window.getComputedStyle;

  window.scrollTo = vi.fn();
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = vi.fn();
  }
}
