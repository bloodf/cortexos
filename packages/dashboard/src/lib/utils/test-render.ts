/**
 * Minimal render helper for Svelte 5 component tests.
 *
 * Why not @testing-library/svelte?
 * ---------------------------------
 * @testing-library/svelte v5 ships its source `.svelte.js` files (not compiled)
 * which use `import * as $ from 'svelte/internal/client'`. The current
 * vite-plugin-svelte / Svelte 5.56 combo rejects that namespace identifier as a
 * reserved name when re-compiling the file. This is a known issue tracked
 * upstream. Until it's resolved, we mount components directly via Svelte's
 * `mount` + jsdom.
 *
 * Usage:
 *   const { container, getByRole } = render(Button, { props: { ... } });
 *   afterEach(cleanup);
 */
import { mount, unmount } from 'svelte';
import type { Component } from 'svelte';
// jsdom v25 ships without bundled types. The shim lives in ./jsdom.d.ts.
import { JSDOM } from 'jsdom';

export interface RenderProps {
  [key: string]: unknown;
}

export interface RenderResult {
  /** The DOM node the component is mounted into. */
  container: HTMLElement;
  /** The body element the container is appended to (for queries). */
  baseElement: HTMLElement;
  /** Re-render with new props. */
  rerender: (next: RenderProps) => void;
  /** Unmount the component. */
  unmount: () => void;
}

/**
 * A loose component type that accepts any Svelte 5 component. Svelte 5's
 * `Component<Props>` is parameterised by a per-component Props type, which
 * makes it too strict to use directly in test helpers. We intentionally widen
 * to `Component<any>` here — the actual prop validation happens at the
 * call-site when TS infers the literal props.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyComponent = Component<any, any, string>;

/** Track every render() call so cleanup() can dispose them. */
const _mounted = new Set<RenderResult>();

/**
 * Set up jsdom-backed document/window globals if they aren't already. vitest
 * with `environment: 'jsdom'` does this for us; this helper is for the case
 * where the test is running in node and only the render helper needs the DOM.
 */
let _jsdomInstalled = false;
function ensureJsdom(): void {
  if (typeof globalThis.document !== 'undefined') return;
  if (_jsdomInstalled) return;
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'http://localhost/',
  });
  (globalThis as unknown as { document: Document }).document = dom.window.document;
  (globalThis as unknown as { window: Window }).window = dom.window as unknown as Window;
  (globalThis as unknown as { navigator: Navigator }).navigator = dom.window.navigator;
  (globalThis as unknown as { HTMLElement: typeof HTMLElement }).HTMLElement =
    dom.window.HTMLElement;
  (globalThis as unknown as { Element: typeof Element }).Element = dom.window.Element;
  (globalThis as unknown as { Node: typeof Node }).Node = dom.window.Node;
  _jsdomInstalled = true;
}

/**
 * Render a Svelte 5 component into a fresh container in the document body.
 *
 * @param component  The Svelte 5 component (a `.svelte` default-exported function).
 * @param options    { props, target? }. `target` defaults to a fresh <div>.
 */
export function render(
  component: AnyComponent,
  options: { props?: RenderProps; target?: HTMLElement } = {},
): RenderResult {
  ensureJsdom();
  const doc = (globalThis as unknown as { document: Document }).document;
  const target = options.target ?? doc.body.appendChild(doc.createElement('div'));

  const componentInstance = mount(component, {
    target,
    props: options.props ?? {},
  });

  const result: RenderResult = {
    container: target as HTMLElement,
    baseElement: doc.body as HTMLElement,
    rerender(next: RenderProps) {
      unmount(componentInstance);
      const fresh = mount(component, { target, props: next });
      (componentInstance as unknown as { _current: unknown })._current = fresh;
    },
    unmount() {
      unmount(componentInstance);
    },
  };
  _mounted.add(result);
  return result;
}

/**
 * Remove all mounted components. Call in `afterEach` to keep tests isolated.
 * Also clears the document body of stray containers.
 */
export function cleanup(): void {
  for (const r of _mounted) {
    try {
      r.unmount();
    } catch {
      // best effort
    }
  }
  _mounted.clear();
  const doc = (globalThis as unknown as { document: Document }).document;
  if (doc?.body) doc.body.innerHTML = '';
}

/** Query helpers re-exported from @testing-library/dom for ergonomics. */
export { screen, within, fireEvent, waitFor } from '@testing-library/dom';
export { default as userEvent } from '@testing-library/user-event';
