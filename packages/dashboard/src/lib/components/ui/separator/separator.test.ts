import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '../../../utils/test-render';
import Separator from './Separator.svelte';

describe('Separator', () => {
  afterEach(cleanup);

  it('renders horizontal by default', () => {
    const { container } = render(Separator);
    const s = container.querySelector('[data-slot="separator"]');
    expect(s?.getAttribute('aria-orientation')).toBe('horizontal');
    expect(s?.className).toContain('h-px');
  });

  it('renders vertical when asked', () => {
    const { container } = render(Separator, { props: { orientation: 'vertical' } });
    const s = container.querySelector('[data-slot="separator"]');
    expect(s?.getAttribute('aria-orientation')).toBe('vertical');
    expect(s?.className).toContain('w-px');
  });
});
