import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '../../../utils/test-render';
import IconButton from './IconButton.svelte';

describe('IconButton', () => {
  afterEach(cleanup);

  it('renders as an icon-sized button', () => {
    const { container } = render(IconButton, { props: { 'aria-label': 'Close' } });
    const btn = container.querySelector('button');
    expect(btn).not.toBeNull();
    expect(btn?.className).toContain('size-8');
  });

  it('requires aria-label (passed as required prop)', () => {
    const { container } = render(IconButton, { props: { 'aria-label': 'Search' } });
    expect(container.querySelector('button')).toHaveAttribute('aria-label', 'Search');
  });

  it('forwards click events', () => {
    let n = 0;
    const { container } = render(IconButton, {
      props: { 'aria-label': 'Edit', onclick: () => n++ },
    });
    container.querySelector('button')?.click();
    expect(n).toBe(1);
  });

  it('respects disabled prop', () => {
    const { container } = render(IconButton, {
      props: { 'aria-label': 'X', disabled: true },
    });
    expect(container.querySelector('button')).toBeDisabled();
  });
});
