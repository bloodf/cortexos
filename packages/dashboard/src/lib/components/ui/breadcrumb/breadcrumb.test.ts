import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '../../../utils/test-render';
import Breadcrumb from './Breadcrumb.svelte';

describe('Breadcrumb', () => {
  afterEach(cleanup);

  it('renders items with aria-current=page on the last', () => {
    const { container } = render(Breadcrumb, {
      props: { items: [{ label: 'Home', href: '/' }, { label: 'Settings' }] },
    });
    const nav = container.querySelector('nav');
    expect(nav?.getAttribute('aria-label')).toBe('Breadcrumb');
    expect(nav?.textContent).toContain('Home');
    expect(nav?.textContent).toContain('Settings');
    const current = nav?.querySelector('[aria-current="page"]');
    expect(current?.textContent).toBe('Settings');
  });

  it('marks the last as current even if href is given', () => {
    const { container } = render(Breadcrumb, {
      props: { items: [{ label: 'A', href: '/a' }, { label: 'B', href: '/b' }] },
    });
    // Last is treated as current regardless of href (the link is not rendered
    // for the last item).
    expect(container.querySelector('[aria-current="page"]')?.textContent).toBe('B');
    expect(container.querySelectorAll('a')).toHaveLength(1);
  });
});
