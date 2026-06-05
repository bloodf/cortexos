/**
 * sheet-mount.test.ts — coverage of Sheet.svelte via Svelte 5 mount.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '$lib/utils/test-render';
import Sheet from '../Sheet.svelte';

afterEach(() => cleanup());

describe('Sheet.svelte — mount', () => {
  it('renders nothing when open=false', () => {
    const { container } = render(Sheet, { props: { open: false } });
    const sheet = container.querySelector('[data-slot="sheet"]');
    expect(sheet).toBeNull();
  });

  it('renders the data-slot root when open=true', () => {
    const { container } = render(Sheet, { props: { open: true } });
    const sheet = container.querySelector('[data-slot="sheet"]');
    expect(sheet).not.toBeNull();
  });

  it('defaults side to right', () => {
    const { container } = render(Sheet, { props: { open: true } });
    const sheet = container.querySelector('[data-slot="sheet"]');
    expect(sheet?.getAttribute('data-side')).toBe('right');
  });

  it('respects an explicit side=left', () => {
    const { container } = render(Sheet, { props: { open: true, side: 'left' } });
    expect(container.querySelector('[data-slot="sheet"]')?.getAttribute('data-side')).toBe('left');
  });

  it('respects side=bottom', () => {
    const { container } = render(Sheet, { props: { open: true, side: 'bottom' } });
    expect(container.querySelector('[data-slot="sheet"]')?.getAttribute('data-side')).toBe('bottom');
  });
});
