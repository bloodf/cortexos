/**
 * dropdown-menu-mount.test.ts — coverage of DropdownMenu.svelte.
 */
import { describe, it, expect, afterEach } from 'vitest';
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
});
