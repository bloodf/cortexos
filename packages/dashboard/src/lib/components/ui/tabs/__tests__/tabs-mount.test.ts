/**
 * tabs-mount.test.ts — coverage of Tabs.svelte via Svelte 5 mount.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '$lib/utils/test-render';
import Tabs from '../Tabs.svelte';

afterEach(() => cleanup());

describe('Tabs.svelte — mount', () => {
  it('renders the data-slot tablist with role=tablist', () => {
    const { container } = render(Tabs, { props: { value: 'a' } });
    const root = container.querySelector('[data-slot="tabs"]');
    expect(root).not.toBeNull();
    expect(root?.getAttribute('role')).toBe('tablist');
  });

  it('applies className passthrough', () => {
    const { container } = render(Tabs, {
      props: { value: 'a', class: 'tab-extra' },
    });
    const root = container.querySelector('[data-slot="tabs"]');
    expect(root?.className).toContain('tab-extra');
  });

  it('renders an empty tablist with no children', () => {
    const { container } = render(Tabs, { props: { value: '' } });
    const root = container.querySelector('[data-slot="tabs"]');
    expect(root).not.toBeNull();
    expect(root?.querySelectorAll('[role="tab"]').length).toBe(0);
  });
});
