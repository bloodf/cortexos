import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '../../../utils/test-render';
import Radio from './Radio.svelte';

describe('Radio', () => {
  afterEach(cleanup);

  it('renders a radio input', () => {
    const { container } = render(Radio);
    const r = container.querySelector('input[type="radio"]');
    expect(r).not.toBeNull();
  });

  it('respects disabled', () => {
    const { container } = render(Radio, { props: { disabled: true } });
    expect(container.querySelector('input')).toBeDisabled();
  });
});
