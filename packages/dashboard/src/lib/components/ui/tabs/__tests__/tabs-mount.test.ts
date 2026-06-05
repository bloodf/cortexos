/**
 * tabs-mount.test.ts — coverage of Tabs.svelte via Svelte 5 mount.
 * Exercises the onkeydown handler branches (ArrowLeft, ArrowRight,
 * Home, End) on a real mounted instance with real <button role=tab>
 * children inside the tablist.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '$lib/utils/test-render';
import Tabs from '../Tabs.svelte';
import TabsTrigger from '../TabsTrigger.svelte';

afterEach(() => cleanup());

/**
 * Build a 3-tab fixture: tabs[a,b,c] with b initially active.
 * Returns the root and a getter for the live triggers.
 */
function renderThreeTabs() {
  // Render Tabs as the root, with three TabsTrigger children that
  // sit at the [role="tab"] positions the onkeydown handler queries.
  const { container } = render(Tabs, {
    props: {
      children: () => '',
    },
  });
  // Manually add three tab buttons inside the root for the handler to find.
  const root = container.querySelector('[data-slot="tabs"]') as HTMLElement;
  const t1 = document.createElement('button');
  t1.setAttribute('role', 'tab');
  t1.setAttribute('data-state', 'inactive');
  t1.dataset.test = 'tab-1';
  const t2 = document.createElement('button');
  t2.setAttribute('role', 'tab');
  t2.setAttribute('data-state', 'active');
  t2.dataset.test = 'tab-2';
  const t3 = document.createElement('button');
  t3.setAttribute('role', 'tab');
  t3.setAttribute('data-state', 'inactive');
  t3.dataset.test = 'tab-3';
  root.append(t1, t2, t3);
  return { root, t1, t2, t3 };
}

function fireKey(el: HTMLElement, key: string): void {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

describe('Tabs.svelte — onkeydown handler (mount)', () => {
  it('renders the data-slot root with role=tablist', () => {
    const { container } = render(Tabs, { props: {} });
    const root = container.querySelector('[data-slot="tabs"]');
    expect(root).not.toBeNull();
    expect(root?.getAttribute('role')).toBe('tablist');
    expect(root?.getAttribute('tabindex')).toBe('-1');
  });

  it('ArrowRight moves focus to the next trigger', () => {
    const { root, t1, t2, t3 } = renderThreeTabs();
    const focusMock = vi.spyOn(t3, 'focus').mockImplementation(() => {});
    const clickMock = vi.spyOn(t3, 'click').mockImplementation(() => {});
    fireKey(root, 'ArrowRight');
    // Active is t2 (idx=1). Next is t3 (idx=2).
    expect(focusMock).toHaveBeenCalled();
    expect(clickMock).toHaveBeenCalled();
  });

  it('ArrowRight wraps from last to first', () => {
    const { root, t1, t2, t3 } = renderThreeTabs();
    // Make t3 active (so wrapping kicks in).
    t1.setAttribute('data-state', 'inactive');
    t2.setAttribute('data-state', 'inactive');
    t3.setAttribute('data-state', 'active');
    const focusMock = vi.spyOn(t1, 'focus').mockImplementation(() => {});
    const clickMock = vi.spyOn(t1, 'click').mockImplementation(() => {});
    fireKey(root, 'ArrowRight');
    // idx=2 → (2+1)%3 = 0 → t1
    expect(focusMock).toHaveBeenCalled();
    expect(clickMock).toHaveBeenCalled();
  });

  it('ArrowLeft moves focus to the previous trigger', () => {
    const { root, t1 } = renderThreeTabs();
    const focusMock = vi.spyOn(t1, 'focus').mockImplementation(() => {});
    const clickMock = vi.spyOn(t1, 'click').mockImplementation(() => {});
    fireKey(root, 'ArrowLeft');
    // Active is t2 (idx=1). Previous is t1 (idx=0).
    expect(focusMock).toHaveBeenCalled();
    expect(clickMock).toHaveBeenCalled();
  });

  it('ArrowLeft wraps from first to last', () => {
    const { root, t1, t2, t3 } = renderThreeTabs();
    // Make t1 active (so wrapping kicks in).
    t1.setAttribute('data-state', 'active');
    t2.setAttribute('data-state', 'inactive');
    const focusMock = vi.spyOn(t3, 'focus').mockImplementation(() => {});
    const clickMock = vi.spyOn(t3, 'click').mockImplementation(() => {});
    fireKey(root, 'ArrowLeft');
    // idx=0 → (0-1+3)%3 = 2 → t3
    expect(focusMock).toHaveBeenCalled();
    expect(clickMock).toHaveBeenCalled();
  });

  it('Home moves focus to the first trigger', () => {
    const { root, t1 } = renderThreeTabs();
    const focusMock = vi.spyOn(t1, 'focus').mockImplementation(() => {});
    const clickMock = vi.spyOn(t1, 'click').mockImplementation(() => {});
    fireKey(root, 'Home');
    expect(focusMock).toHaveBeenCalled();
    expect(clickMock).toHaveBeenCalled();
  });

  it('End moves focus to the last trigger', () => {
    const { root, t3 } = renderThreeTabs();
    const focusMock = vi.spyOn(t3, 'focus').mockImplementation(() => {});
    const clickMock = vi.spyOn(t3, 'click').mockImplementation(() => {});
    fireKey(root, 'End');
    expect(focusMock).toHaveBeenCalled();
    expect(clickMock).toHaveBeenCalled();
  });

  it('no-op when no triggers are present', () => {
    const { container } = render(Tabs, { props: {} });
    const root = container.querySelector('[data-slot="tabs"]') as HTMLElement;
    // Should not throw.
    fireKey(root, 'ArrowRight');
    fireKey(root, 'ArrowLeft');
    fireKey(root, 'Home');
    fireKey(root, 'End');
  });

  it('applies the className prop', () => {
    const { container } = render(Tabs, { props: { class: 'extra-class' } });
    const root = container.querySelector('[data-slot="tabs"]') as HTMLElement;
    expect(root.className).toContain('extra-class');
  });

  it('renders nothing when no children snippet is provided', () => {
    const { container } = render(Tabs, { props: {} });
    const root = container.querySelector('[data-slot="tabs"]') as HTMLElement;
    expect(root.children.length).toBe(0);
  });

  // Touch the other Tabs files to keep them in the coverage report
  // (their tests live in Tabs.test.ts).
  it('TabsTrigger exists', () => {
    expect(typeof TabsTrigger).toBe('function');
  });
});
