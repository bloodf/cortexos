import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '../../../utils/test-render';
import Progress from './Progress.svelte';

describe('Progress', () => {
  afterEach(cleanup);

  it('renders a progress element', () => {
    const { container } = render(Progress, { props: { value: 50 } });
    const p = container.querySelector('progress');
    expect(p).not.toBeNull();
    expect(p?.getAttribute('value')).toBe('50');
  });

  it('sets aria-valuenow correctly', () => {
    const { container } = render(Progress, { props: { value: 25, max: 100 } });
    expect(container.querySelector('progress')).toHaveAttribute('aria-valuenow', '25');
  });

  it('clamps to max', () => {
    const { container } = render(Progress, { props: { value: 150, max: 100 } });
    const label = container.querySelector('[data-slot="progress-label"]');
    expect(label?.textContent).toContain('100%');
  });
});
