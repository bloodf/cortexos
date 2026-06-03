import { describe, it, expect, afterEach, vi } from 'vitest';
import { tick } from 'svelte';
import { render, cleanup, fireEvent } from '../../../utils/test-render';
import Dialog from './Dialog.svelte';

describe('Dialog', () => {
  afterEach(cleanup);

  it('renders nothing when open is false', () => {
    const { container } = render(Dialog, { props: { open: false } });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('renders content when open is true', () => {
    const { container } = render(Dialog, { props: { open: true } });
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="dialog-overlay"]')).not.toBeNull();
  });

  it('has aria-modal=true', () => {
    const { container } = render(Dialog, { props: { open: true } });
    expect(container.querySelector('[role="dialog"]')).toHaveAttribute('aria-modal', 'true');
  });

  it('closes on overlay click', () => {
    const onclose = vi.fn();
    const { container } = render(Dialog, { props: { open: true, onclose } });
    fireEvent.click(container.querySelector('[data-slot="dialog-overlay"]')!);
    expect(onclose).toHaveBeenCalled();
  });

  it('closes on Escape (calls onclose)', async () => {
    const onclose = vi.fn();
    render(Dialog, { props: { open: true, onclose } });
    // Wait for the Svelte $effect to install the keydown listener.
    await tick();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(onclose).toHaveBeenCalled();
  });

  it('wraps content in dialog-content slot', () => {
    const { container } = render(Dialog, { props: { open: true } });
    expect(container.querySelector('[data-slot="dialog-content"]')).not.toBeNull();
  });
});
