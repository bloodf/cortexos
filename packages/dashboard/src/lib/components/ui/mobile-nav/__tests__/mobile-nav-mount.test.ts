/**
 * mobile-nav-mount.test.ts — coverage of MobileNav.svelte.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '$lib/utils/test-render';
import MobileNav from '../MobileNav.svelte';

afterEach(() => cleanup());

describe('MobileNav.svelte — mount', () => {
  it('renders the data-slot root', () => {
    const { container } = render(MobileNav, { props: { open: false } });
    const root = container.querySelector('[data-slot="mobile-nav"]');
    expect(root).not.toBeNull();
  });

  it('renders with the open=true prop without crashing', () => {
    const { container } = render(MobileNav, { props: { open: true } });
    const root = container.querySelector('[data-slot="mobile-nav"]');
    expect(root).not.toBeNull();
  });
});
