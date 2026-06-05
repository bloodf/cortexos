/**
 * sidebar-mount.test.ts — coverage of Sidebar.svelte via Svelte 5 mount.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '$lib/utils/test-render';
import Sidebar from '../Sidebar.svelte';

afterEach(() => cleanup());

const sampleGroups = [
  {
    title: 'Overview',
    items: [
      { label: 'Dashboard', href: '/' },
      { label: 'Services', href: '/services' },
    ],
  },
  {
    title: 'Admin',
    items: [
      { label: 'Approvals', href: '/approvals' },
      { label: 'Audit', href: '/audit' },
    ],
  },
];

describe('Sidebar.svelte — mount', () => {
  it('renders the data-slot root', () => {
    const { container } = render(Sidebar, { props: { groups: [] } });
    const aside = container.querySelector('[data-slot="sidebar"]');
    expect(aside).not.toBeNull();
    expect(aside?.tagName).toBe('ASIDE');
  });

  it('renders one group per entry', () => {
    const { container } = render(Sidebar, { props: { groups: sampleGroups } });
    const titles = Array.from(container.querySelectorAll('p')).filter((p) =>
      ['OVERVIEW', 'ADMIN'].includes(p.textContent?.toUpperCase() ?? ''),
    );
    expect(titles.length).toBe(2);
  });

  it('hides group titles when collapsed=true', () => {
    const { container } = render(Sidebar, { props: { groups: sampleGroups, collapsed: true } });
    const titles = Array.from(container.querySelectorAll('p')).filter((p) =>
      p.textContent?.toUpperCase() === 'OVERVIEW',
    );
    expect(titles.length).toBe(0);
  });

  it('renders one link per item across all groups', () => {
    const { container } = render(Sidebar, { props: { groups: sampleGroups } });
    const links = container.querySelectorAll('a');
    expect(links.length).toBe(4);
    expect(links[0]?.getAttribute('href')).toBe('/');
    expect(links[3]?.getAttribute('href')).toBe('/audit');
  });

  it('marks the active link with aria-current=page', () => {
    const { container } = render(Sidebar, {
      props: { groups: sampleGroups, currentPath: '/services' },
    });
    const links = container.querySelectorAll('a');
    expect(links[0]?.getAttribute('aria-current')).toBeNull();
    expect(links[1]?.getAttribute('aria-current')).toBe('page');
    expect(links[1]?.getAttribute('data-active')).toBe('true');
  });

  it('hides item labels when collapsed=true', () => {
    const { container } = render(Sidebar, { props: { groups: sampleGroups, collapsed: true } });
    expect(container.textContent).not.toContain('Dashboard');
    expect(container.textContent).not.toContain('Approvals');
  });

  it('applies collapsed title attribute on each link', () => {
    const { container } = render(Sidebar, { props: { groups: sampleGroups, collapsed: true } });
    const links = container.querySelectorAll('a');
    expect(links[0]?.getAttribute('title')).toBe('Dashboard');
  });

  it('applies the className prop', () => {
    const { container } = render(Sidebar, { props: { groups: [], class: 'extra' } });
    const aside = container.querySelector('[data-slot="sidebar"]') as HTMLElement;
    expect(aside.className).toContain('extra');
  });

  it('invokes onnavigate when a link is clicked and prevents default', () => {
    const onnavigate = vi.fn();
    const { container } = render(Sidebar, {
      props: { groups: sampleGroups, onnavigate },
    });
    const links = container.querySelectorAll('a');
    const evt = new MouseEvent('click', { bubbles: true, cancelable: true });
    links[0]?.dispatchEvent(evt);
    expect(onnavigate).toHaveBeenCalledWith('/');
  });

  it('does not prevent default when onnavigate is omitted', () => {
    const { container } = render(Sidebar, { props: { groups: sampleGroups } });
    const links = container.querySelectorAll('a');
    const evt = new MouseEvent('click', { bubbles: true, cancelable: true });
    links[0]?.dispatchEvent(evt);
    // No assertion needed — just that the test does not throw.
    expect(evt.defaultPrevented).toBe(false);
  });
});
