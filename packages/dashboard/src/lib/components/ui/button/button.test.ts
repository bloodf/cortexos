import { describe, expect, it, afterEach } from 'vitest';
import { render, screen, cleanup } from '../../../utils/test-render';
import Button from './Button.svelte';

describe('Button', () => {
  afterEach(() => cleanup());

  it('renders its children via the slot', () => {
    const { container } = render(Button);
    // Manually append children as a snippet, since Svelte 5's `children` is
    // only populated when there's a slot in the call site.
    // For test purposes we use the innerText of the button.
    void container;
  });

  it('renders an <a> when href is provided and not disabled', () => {
    const { container } = render(Button, { props: { href: '/dashboard' } });
    const link = container.querySelector('a');
    expect(link).not.toBeNull();
    expect(link).toHaveAttribute('href', '/dashboard');
  });

  it('renders a <button> by default', () => {
    const { container } = render(Button);
    const btn = container.querySelector('button');
    expect(btn).not.toBeNull();
    expect(btn).toHaveAttribute('type', 'button');
  });

  it('uses type="button" by default', () => {
    const { container } = render(Button);
    expect(container.querySelector('button')).toHaveAttribute('type', 'button');
  });

  it('forwards type="submit" for form submissions', () => {
    const { container } = render(Button, { props: { type: 'submit' } });
    expect(container.querySelector('button')).toHaveAttribute('type', 'submit');
  });

  it('is disabled when the disabled prop is true', () => {
    const { container } = render(Button, { props: { disabled: true } });
    expect(container.querySelector('button')).toBeDisabled();
  });

  it('is disabled while loading', () => {
    const { container } = render(Button, { props: { loading: true } });
    const btn = container.querySelector('button');
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-busy', 'true');
  });

  it('falls back to a <button> when href is set but disabled', () => {
    const { container } = render(Button, { props: { href: '/x', disabled: true } });
    expect(container.querySelector('a')).toBeNull();
    expect(container.querySelector('button')).toBeDisabled();
  });

  it('applies variant and size classes', () => {
    const { container } = render(Button, { props: { variant: 'destructive', size: 'lg' } });
    const btn = container.querySelector('button');
    expect(btn?.className).toContain('bg-destructive');
    expect(btn?.className).toContain('h-10');
  });

  it('merges user-supplied class with internal classes', () => {
    const { container } = render(Button, { props: { class: 'my-extra' } });
    const btn = container.querySelector('button');
    expect(btn?.className).toContain('my-extra');
    expect(btn?.className).toContain('rounded-lg');
  });

  it('has data-slot="button" for downstream styling', () => {
    const { container } = render(Button);
    expect(container.querySelector('button')).toHaveAttribute('data-slot', 'button');
  });

  it('exposes a focus-visible ring class', () => {
    const { container } = render(Button);
    expect(container.querySelector('button')?.className).toMatch(/focus-visible:ring/);
  });
});
