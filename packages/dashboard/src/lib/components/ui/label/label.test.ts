import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '../../../utils/test-render';
import Label from './Label.svelte';

describe('Label', () => {
  afterEach(cleanup);

  it('renders a <label>', () => {
    const { container } = render(Label);
    const l = container.querySelector('label');
    expect(l).not.toBeNull();
    expect(l?.getAttribute('data-slot')).toBe('label');
  });

  it('forwards htmlFor', () => {
    const { container } = render(Label, { props: { for: 'email-input' } });
    expect(container.querySelector('label')).toHaveAttribute('for', 'email-input');
  });
});
