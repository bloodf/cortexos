import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '../../../utils/test-render';
import StatCard from './StatCard.svelte';

describe('StatCard', () => {
  afterEach(cleanup);

  it('renders label and value', () => {
    const { container } = render(StatCard, { props: { label: 'Users', value: 1234 } });
    // StatCard renders a Card; the value lives in [data-slot="stat-card-value"]
    const value = container.querySelector('[data-slot="stat-card-value"]');
    expect(value).not.toBeNull();
    expect(value?.textContent?.trim()).toBe('1234');
    expect(container.textContent).toContain('Users');
  });

  it('renders the delta with trend class', () => {
    const { container } = render(StatCard, {
      props: { label: 'CPU', value: '70%', delta: '+5%', deltaTrend: 'up' },
    });
    expect(container.textContent).toContain('+5%');
    expect(container.textContent).toContain('↑');
  });

  it('renders the sparkline when given data', () => {
    const { container } = render(StatCard, {
      props: {
        label: 'Memory',
        value: '4 GB',
        sparkline: [{ value: 1 }, { value: 2 }, { value: 4 }, { value: 3 }, { value: 5 }],
      },
    });
    const svg = container.querySelector('svg[data-slot="stat-card-sparkline"]');
    expect(svg).not.toBeNull();
  });
});
