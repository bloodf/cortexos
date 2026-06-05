/**
 * collapsible-mount.test.ts — coverage of Collapsible.svelte via Svelte 5 mount.
 *
 * Exercises the open/closed state branches, the data-slot root,
 * and the class prop.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '$lib/utils/test-render';
import Collapsible from '../Collapsible.svelte';

afterEach(() => cleanup());

describe('Collapsible.svelte — mount', () => {
  it('renders the data-slot root with data-state=closed by default', () => {
    const { container } = render(Collapsible, { props: {} });
    const root = container.querySelector('[data-slot="collapsible"]');
    expect(root).not.toBeNull();
    expect(root?.getAttribute('data-state')).toBe('closed');
  });

  it('reflects the open prop with data-state=open', () => {
    const { container } = render(Collapsible, { props: { open: true } });
    const root = container.querySelector('[data-slot="collapsible"]');
    expect(root?.getAttribute('data-state')).toBe('open');
  });

  it('flips to closed when open is re-rendered as false', () => {
    const { container, rerender } = render(Collapsible, { props: { open: true } });
    expect(container.querySelector('[data-slot="collapsible"]')?.getAttribute('data-state')).toBe('open');
    rerender({ open: false });
    expect(container.querySelector('[data-slot="collapsible"]')?.getAttribute('data-state')).toBe('closed');
  });

  it('applies class prop to the root', () => {
    const { container } = render(Collapsible, { props: { class: 'my-extra' } });
    const root = container.querySelector('[data-slot="collapsible"]');
    expect(root?.className).toContain('my-extra');
  });
});
