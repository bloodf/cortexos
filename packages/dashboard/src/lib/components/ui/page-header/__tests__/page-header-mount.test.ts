/**
 * page-header.test.ts — coverage of the PageHeader.svelte component.
 *
 * Renders the component via the test-render helper (Svelte 5 mount +
 * jsdom) and asserts the data-slot / title / subtitle / actions
 * branches.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '$lib/utils/test-render';
import PageHeader from '../PageHeader.svelte';

afterEach(() => cleanup());

describe('PageHeader.svelte — mount', () => {
  it('renders the data-slot root', () => {
    const { container } = render(PageHeader, {
      props: { title: 'My title' },
    });
    const root = container.querySelector('[data-slot="page-header"]');
    expect(root).not.toBeNull();
  });

  it('renders the title', () => {
    const { container } = render(PageHeader, {
      props: { title: 'Dashboard' },
    });
    const heading = container.querySelector('h1');
    expect(heading).not.toBeNull();
    expect(heading?.textContent).toContain('Dashboard');
  });

  it('renders the description when provided', () => {
    const { container } = render(PageHeader, {
      props: { title: 'T', description: 'long-form help' },
    });
    const desc = container.querySelector('[data-slot="page-header-description"]');
    expect(desc).not.toBeNull();
    expect(container.textContent).toContain('long-form help');
  });

  it('omits the description element when not provided', () => {
    const { container } = render(PageHeader, {
      props: { title: 'T' },
    });
    const desc = container.querySelector('[data-slot="page-header-description"]');
    expect(desc).toBeNull();
  });

  it('renders breadcrumb slot when provided', () => {
    const { container } = render(PageHeader, {
      props: {
        title: 'T',
        breadcrumb: (() => 'home › page') as never,
      },
    });
    const crumb = container.querySelector('[data-slot="page-header-breadcrumb"]');
    expect(crumb).not.toBeNull();
  });

  it('renders actions slot when provided', () => {
    const { container } = render(PageHeader, {
      props: {
        title: 'T',
        actions: (() => 'act') as never,
      },
    });
    const actions = container.querySelector('[data-slot="page-header-actions"]');
    expect(actions).not.toBeNull();
  });

  it('applies extra className', () => {
    const { container } = render(PageHeader, {
      props: { title: 'T', class: 'custom-class' },
    });
    const root = container.querySelector('[data-slot="page-header"]');
    expect(root?.className).toContain('custom-class');
  });
});
