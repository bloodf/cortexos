import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '../../../utils/test-render';
import Slider from './Slider.svelte';

describe('Slider', () => {
  afterEach(cleanup);

  it('renders a range input', () => {
    const { container } = render(Slider, { props: { 'aria-label': 'Volume' } });
    const s = container.querySelector('input[type="range"]');
    expect(s).not.toBeNull();
    expect(s?.getAttribute('aria-label')).toBe('Volume');
  });

  it('forwards min/max/step', () => {
    const { container } = render(Slider, { props: { min: -10, max: 10, step: 0.5 } });
    const s = container.querySelector('input')!;
    expect(s.getAttribute('min')).toBe('-10');
    expect(s.getAttribute('max')).toBe('10');
    expect(s.getAttribute('step')).toBe('0.5');
  });
});
