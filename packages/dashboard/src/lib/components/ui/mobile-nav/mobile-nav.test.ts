import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '../../../utils/test-render';
import MobileNav from './MobileNav.svelte';

describe('MobileNav', () => {
  afterEach(cleanup);

  it('renders items', () => {
    const items = [
      { label: 'Home', href: '/' },
      { label: 'Apps', href: '/apps' },
    ];
    const { container } = render(MobileNav, { props: { items } });
    expect(container.textContent).toContain('Home');
    expect(container.textContent).toContain('Apps');
  });

  it('marks the active item', () => {
    const items = [{ label: 'Home', href: '/' }];
    const { container } = render(MobileNav, { props: { items, currentPath: '/' } });
    const link = container.querySelector('a[href="/"]');
    expect(link?.getAttribute('aria-current')).toBe('page');
  });
});
