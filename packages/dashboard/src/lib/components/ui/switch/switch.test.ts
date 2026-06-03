import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '../../../utils/test-render';
import userEvent from '@testing-library/user-event';
import Switch from './Switch.svelte';

describe('Switch', () => {
  afterEach(cleanup);

  it('renders a switch with role=switch', () => {
    const { container } = render(Switch, { props: { 'aria-label': 'Notifications' } });
    const i = container.querySelector('input[role="switch"]');
    expect(i).not.toBeNull();
  });

  it('toggles checked on click', async () => {
    const user = userEvent.setup();
    const { container } = render(Switch, { props: { 'aria-label': 'X' } });
    const i = container.querySelector('input[role="switch"]')!;
    await user.click(i);
    expect((i as HTMLInputElement).checked).toBe(true);
  });

  it('respects disabled', () => {
    const { container } = render(Switch, { props: { 'aria-label': 'X', disabled: true } });
    expect(container.querySelector('input')).toBeDisabled();
  });
});
