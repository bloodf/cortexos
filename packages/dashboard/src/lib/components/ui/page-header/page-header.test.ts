import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '../../../utils/test-render';
import PageHeader from './PageHeader.svelte';

describe('PageHeader', () => {
  afterEach(cleanup);

  it('renders title', () => {
    const { container } = render(PageHeader, { props: { title: 'Overview' } });
    const t = container.querySelector('[data-slot="page-header-title"]');
    expect(t?.textContent).toBe('Overview');
  });

  it('renders description', () => {
    const { container } = render(PageHeader, {
      props: { title: 'X', description: 'A helpful page' },
    });
    expect(container.textContent).toContain('A helpful page');
  });
});
