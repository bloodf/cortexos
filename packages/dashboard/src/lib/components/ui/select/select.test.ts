import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '../../../utils/test-render';
import Select from './Select.svelte';

describe('Select', () => {
  afterEach(cleanup);

  it('renders a select', () => {
    const { container } = render(Select);
    const s = container.querySelector('select');
    expect(s).not.toBeNull();
  });

  it('respects disabled', () => {
    const { container } = render(Select, { props: { disabled: true } });
    expect(container.querySelector('select')).toBeDisabled();
  });
});
