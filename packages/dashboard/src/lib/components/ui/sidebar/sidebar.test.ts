import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '../../../utils/test-render';
import Sidebar from './Sidebar.svelte';

describe('Sidebar', () => {
  afterEach(cleanup);

  it('renders groups and items', () => {
    const groups = [
      {
        title: 'Platform',
        items: [
          { label: 'Overview', href: '/overview' },
          { label: 'Apps', href: '/apps' },
        ],
      },
    ];
    const { container } = render(Sidebar, { props: { groups } });
    const aside = container.querySelector('[data-slot="sidebar"]');
    expect(aside?.textContent).toContain('Platform');
    expect(aside?.textContent).toContain('Overview');
    expect(aside?.textContent).toContain('Apps');
  });

  it('marks the active item', () => {
    const groups = [{ title: 'X', items: [{ label: 'A', href: '/a' }] }];
    const { container } = render(Sidebar, { props: { groups, currentPath: '/a' } });
    const link = container.querySelector('a[href="/a"]');
    expect(link?.getAttribute('aria-current')).toBe('page');
    expect(link?.getAttribute('data-active')).toBe('true');
  });

  it('respects collapsed prop (hides labels)', () => {
    const groups = [{ title: 'X', items: [{ label: 'A', href: '/a' }] }];
    const { container } = render(Sidebar, { props: { groups, collapsed: true } });
    expect(container.textContent).not.toContain('A'); // label hidden
  });
});
