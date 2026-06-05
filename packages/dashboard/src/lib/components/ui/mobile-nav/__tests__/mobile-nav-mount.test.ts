/**
 * mobile-nav-mount.test.ts — coverage of MobileNav.svelte.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '$lib/utils/test-render';
import MobileNav from '../MobileNav.svelte';

afterEach(() => cleanup());

describe('MobileNav.svelte — mount', () => {
  it('renders the data-slot root', () => {
    const { container } = render(MobileNav, { props: { items: [] } });
    const root = container.querySelector('[data-slot="mobile-nav"]');
    expect(root).not.toBeNull();
    expect(root?.tagName).toBe('NAV');
  });

  it('renders nothing inside when items is empty', () => {
    const { container } = render(MobileNav, { props: { items: [] } });
    const nav = container.querySelector('[data-slot="mobile-nav"]') as HTMLElement;
    expect(nav.querySelectorAll('a').length).toBe(0);
  });

  it('renders one link per item', () => {
    const items = [
      { label: 'Home', href: '/' },
      { label: 'Services', href: '/services' },
      { label: 'Alerts', href: '/alerts' },
    ];
    const { container } = render(MobileNav, { props: { items } });
    const links = container.querySelectorAll('a');
    expect(links.length).toBe(3);
    expect(links[0]?.getAttribute('href')).toBe('/');
    expect(links[1]?.getAttribute('href')).toBe('/services');
    expect(links[2]?.getAttribute('href')).toBe('/alerts');
  });

  it('marks the current item with aria-current=page and data-active=true', () => {
    const items = [
      { label: 'Home', href: '/' },
      { label: 'Services', href: '/services' },
    ];
    const { container } = render(MobileNav, {
      props: { items, currentPath: '/services' },
    });
    const links = container.querySelectorAll('a');
    expect(links[0]?.getAttribute('aria-current')).toBeNull();
    expect(links[0]?.getAttribute('data-active')).toBe('false');
    expect(links[1]?.getAttribute('aria-current')).toBe('page');
    expect(links[1]?.getAttribute('data-active')).toBe('true');
  });

  it('applies the className prop', () => {
    const { container } = render(MobileNav, {
      props: { items: [], class: 'extra' },
    });
    const nav = container.querySelector('[data-slot="mobile-nav"]') as HTMLElement;
    expect(nav.className).toContain('extra');
  });
});
