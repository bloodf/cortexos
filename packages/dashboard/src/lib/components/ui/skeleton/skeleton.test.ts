import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '../../../utils/test-render';
import Skeleton from './Skeleton.svelte';

describe('Skeleton', () => {
  afterEach(cleanup);

  it('renders a skeleton', () => {
    const { container } = render(Skeleton);
    const s = container.querySelector('[data-slot="skeleton"]');
    expect(s).not.toBeNull();
    expect(s?.className).toContain('animate-pulse');
    expect(s?.className).toContain('bg-muted');
  });

  it('forwards width/height as inline styles', () => {
    const { container } = render(Skeleton, { props: { width: '200px', height: '16px' } });
    const s = container.querySelector('[data-slot="skeleton"]') as HTMLElement;
    expect(s.style.width).toBe('200px');
    expect(s.style.height).toBe('16px');
  });

  it('marks aria-busy for screen readers', () => {
    const { container } = render(Skeleton);
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  });
});
