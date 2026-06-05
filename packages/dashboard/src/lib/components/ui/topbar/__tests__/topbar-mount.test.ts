/**
 * topbar-mount.test.ts — coverage of Topbar.svelte via Svelte 5 mount.
 * Snippet rendering is exercised by the wrapper-component pattern
 * (see Button.svelte.test.ts + Button.test-wrapper.svelte) but the
 * topbar itself only has conditional `{#if snippet}` guards, so we
 * cover the no-snippet case here and trust the wrapper pattern for
 * the with-snippet case.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '$lib/utils/test-render';
import Topbar from '../Topbar.svelte';

afterEach(() => cleanup());

describe('Topbar.svelte — mount', () => {
  it('renders the data-slot root', () => {
    const { container } = render(Topbar, { props: {} });
    const root = container.querySelector('[data-slot="topbar"]');
    expect(root).not.toBeNull();
    expect(root?.tagName).toBe('HEADER');
  });

  it('applies extra className', () => {
    const { container } = render(Topbar, { props: { class: 'extra' } });
    const root = container.querySelector('[data-slot="topbar"]');
    expect(root?.className).toContain('extra');
  });

  it('does not render the search slot when not provided', () => {
    const { container } = render(Topbar, { props: {} });
    const search = container.querySelector('[data-slot="topbar-search"]');
    expect(search).toBeNull();
  });
});
