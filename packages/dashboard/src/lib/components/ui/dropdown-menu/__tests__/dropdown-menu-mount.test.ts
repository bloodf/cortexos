/**
 * dropdown-menu-mount.test.ts — coverage of DropdownMenu.svelte.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '$lib/utils/test-render';
import DropdownMenu from '../DropdownMenu.svelte';

afterEach(() => cleanup());

describe('DropdownMenu.svelte — mount', () => {
  it('renders the root data-slot when open', () => {
    const { container } = render(DropdownMenu, { props: { open: true } });
    const root = container.querySelector('[data-slot="dropdown-menu"]');
    expect(root).not.toBeNull();
  });

  it('does not render the content when closed', () => {
    const { container } = render(DropdownMenu, { props: { open: false } });
    const content = container.querySelector('[data-slot="dropdown-menu-content"]');
    expect(content).toBeNull();
  });

  it('renders the content panel when open', () => {
    const { container } = render(DropdownMenu, { props: { open: true } });
    const content = container.querySelector('[data-slot="dropdown-menu-content"]');
    expect(content).not.toBeNull();
    expect(content?.getAttribute('role')).toBe('menu');
    expect(content?.getAttribute('tabindex')).toBe('-1');
  });

  it('Escape key closes the menu', async () => {
    const { container } = render(DropdownMenu, { props: { open: true } });
    await new Promise((r) => setTimeout(r, 0));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await Promise.resolve();
    // After the Escape key fires, open becomes false; the component
    // re-renders without the content.
    const content = container.querySelector('[data-slot="dropdown-menu-content"]');
    expect(content).toBeNull();
  });

  it('non-Escape key does not close the menu', async () => {
    const { container } = render(DropdownMenu, { props: { open: true } });
    await new Promise((r) => setTimeout(r, 0));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    await Promise.resolve();
    const content = container.querySelector('[data-slot="dropdown-menu-content"]');
    expect(content).not.toBeNull();
  });

  it('Escape on a closed menu is a no-op (handler returns early)', async () => {
    render(DropdownMenu, { props: { open: false } });
    await new Promise((r) => setTimeout(r, 0));
    // Should not throw.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await Promise.resolve();
  });

  it('ArrowDown moves focus to the next menuitem', () => {
    const { container } = render(DropdownMenu, { props: { open: true } });
    const content = container.querySelector('[data-slot="dropdown-menu-content"]') as HTMLElement;
    const item1 = document.createElement('div');
    item1.setAttribute('role', 'menuitem');
    item1.tabIndex = -1;
    const item2 = document.createElement('div');
    item2.setAttribute('role', 'menuitem');
    item2.tabIndex = -1;
    const focusMock = vi.spyOn(item2, 'focus').mockImplementation(() => {});
    content.append(item1, item2);
    item1.focus();
    content.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(focusMock).toHaveBeenCalled();
  });

  it('ArrowUp wraps from first to last menuitem', () => {
    const { container } = render(DropdownMenu, { props: { open: true } });
    const content = container.querySelector('[data-slot="dropdown-menu-content"]') as HTMLElement;
    const item1 = document.createElement('div');
    item1.setAttribute('role', 'menuitem');
    item1.tabIndex = -1;
    const item2 = document.createElement('div');
    item2.setAttribute('role', 'menuitem');
    item2.tabIndex = -1;
    const focusMock = vi.spyOn(item2, 'focus').mockImplementation(() => {});
    content.append(item1, item2);
    item1.focus();
    content.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(focusMock).toHaveBeenCalled();
  });

  it('ArrowDown with no menuitems is a no-op', () => {
    const { container } = render(DropdownMenu, { props: { open: true } });
    const content = container.querySelector('[data-slot="dropdown-menu-content"]') as HTMLElement;
    expect(() =>
      content.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })),
    ).not.toThrow();
  });

  it('clicking the overlay closes the menu', async () => {
    const { container } = render(DropdownMenu, { props: { open: true } });
    const overlay = container.querySelector('[data-slot="dropdown-menu"]') as HTMLElement;
    overlay.click();
    await Promise.resolve();
    const content = container.querySelector('[data-slot="dropdown-menu-content"]');
    expect(content).toBeNull();
  });

  it('clicking the content panel does not close the menu (stopPropagation)', async () => {
    const { container } = render(DropdownMenu, { props: { open: true } });
    const content = container.querySelector('[data-slot="dropdown-menu-content"]') as HTMLElement;
    content.click();
    await Promise.resolve();
    const stillOpen = container.querySelector('[data-slot="dropdown-menu-content"]');
    expect(stillOpen).not.toBeNull();
  });
});
