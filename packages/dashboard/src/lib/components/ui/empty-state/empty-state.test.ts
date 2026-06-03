import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '../../../utils/test-render';
import EmptyState from './EmptyState.svelte';

describe('EmptyState', () => {
  afterEach(cleanup);

  it('renders title and description', () => {
    const { container } = render(EmptyState, {
      props: { title: 'No data', description: 'Add some data to get started.' },
    });
    const node = container.querySelector('[data-slot="empty-state"]');
    expect(node).not.toBeNull();
    expect(node?.textContent).toContain('No data');
    expect(node?.textContent).toContain('Add some data');
  });

  it('renders with dashed border', () => {
    const { container } = render(EmptyState);
    expect(container.querySelector('[data-slot="empty-state"]')?.className).toContain('border-dashed');
  });
});
