import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '../../../utils/test-render';
import Badge from './Badge.svelte';

describe('Badge', () => {
  afterEach(cleanup);

  it('renders a badge shell', () => {
    const { container } = render(Badge);
    const b = container.querySelector('[data-slot="badge"]');
    expect(b).not.toBeNull();
    expect(b?.className).toContain('rounded-full');
  });

  it('applies variant classes', () => {
    const { container } = render(Badge, { props: { variant: 'success' } });
    const b = container.querySelector('[data-slot="badge"]');
    expect(b?.className).toContain('text-success');
  });

  it('applies size classes', () => {
    const { container } = render(Badge, { props: { size: 'sm' } });
    const b = container.querySelector('[data-slot="badge"]');
    expect(b?.className).toContain('h-4');
  });
});
