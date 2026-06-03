import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '../../../utils/test-render';
import userEvent from '@testing-library/user-event';
import Checkbox from './Checkbox.svelte';

describe('Checkbox', () => {
  afterEach(cleanup);

  it('renders an unchecked checkbox', () => {
    const { container } = render(Checkbox);
    const c = container.querySelector('input[type="checkbox"]');
    expect(c).not.toBeNull();
    expect((c as HTMLInputElement).checked).toBe(false);
  });

  it('toggles checked on click', async () => {
    const user = userEvent.setup();
    const { container } = render(Checkbox);
    const c = container.querySelector('input[type="checkbox"]')!;
    await user.click(c);
    expect((c as HTMLInputElement).checked).toBe(true);
    await user.click(c);
    expect((c as HTMLInputElement).checked).toBe(false);
  });

  it('respects disabled', () => {
    const { container } = render(Checkbox, { props: { disabled: true } });
    expect(container.querySelector('input')).toBeDisabled();
  });
});
