import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '../../../utils/test-render';
import userEvent from '@testing-library/user-event';
import Input from './Input.svelte';

describe('Input', () => {
  afterEach(cleanup);

  it('renders an input', () => {
    const { container } = render(Input, { props: { placeholder: 'Email' } });
    const i = container.querySelector('input');
    expect(i).not.toBeNull();
    expect(i?.getAttribute('placeholder')).toBe('Email');
  });

  it('supports typing via userEvent', async () => {
    const user = userEvent.setup();
    let value = '';
    const { container } = render(Input, {
      props: { oninput: (e: Event) => (value = (e.target as HTMLInputElement).value) },
    });
    const i = container.querySelector('input')!;
    await user.type(i, 'hello');
    expect(value).toBe('hello');
  });

  it('forwards type=email', () => {
    const { container } = render(Input, { props: { type: 'email' } });
    expect(container.querySelector('input')?.getAttribute('type')).toBe('email');
  });

  it('respects disabled', () => {
    const { container } = render(Input, { props: { disabled: true } });
    expect(container.querySelector('input')).toBeDisabled();
  });

  it('marks aria-invalid when invalid prop is set', () => {
    const { container } = render(Input, { props: { invalid: true } });
    expect(container.querySelector('input')).toHaveAttribute('aria-invalid', 'true');
  });
});
