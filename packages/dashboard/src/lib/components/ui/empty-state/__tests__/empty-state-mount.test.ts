/**
 * empty-state-mount.test.ts — coverage of EmptyState.svelte.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '$lib/utils/test-render';
import EmptyState from '../EmptyState.svelte';

afterEach(() => cleanup());

describe('EmptyState.svelte — mount', () => {
  it('renders the data-slot root', () => {
    const { container } = render(EmptyState, { props: {} });
    expect(container.querySelector('[data-slot="empty-state"]')).not.toBeNull();
  });

  it('renders the title when provided', () => {
    const { container } = render(EmptyState, { props: { title: 'Nothing here' } });
    expect(container.textContent).toContain('Nothing here');
  });

  it('renders the description when provided', () => {
    const { container } = render(EmptyState, { props: { description: 'Try later' } });
    expect(container.textContent).toContain('Try later');
  });

  it('applies className passthrough', () => {
    const { container } = render(EmptyState, { props: { class: 'extra-class' } });
    const root = container.querySelector('[data-slot="empty-state"]');
    expect(root?.className).toContain('extra-class');
  });
});
