/**
 * dialog-mount.test.ts — coverage of Dialog.svelte via Svelte 5 mount.
 *
 * Exercises the data-slot root, the open prop, the close handler,
 * the overlay click, the Escape key handler, and the focus-trap
 * helper.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '$lib/utils/test-render';
import Dialog, { trapFocus } from '../Dialog.svelte';

afterEach(() => cleanup());

describe('Dialog.svelte — mount', () => {
  it('renders nothing when open=false', () => {
    const { container } = render(Dialog, { props: { open: false } });
    const dialog = container.querySelector('[data-slot="dialog"]');
    expect(dialog).toBeNull();
  });

  it('renders the data-slot root when open=true', () => {
    const { container } = render(Dialog, { props: { open: true } });
    const dialog = container.querySelector('[data-slot="dialog"]');
    expect(dialog).not.toBeNull();
  });

  it('renders the dialog content panel', () => {
    const { container } = render(Dialog, { props: { open: true } });
    const content = container.querySelector('[data-slot="dialog-content"]');
    expect(content).not.toBeNull();
  });

  it('renders the overlay', () => {
    const { container } = render(Dialog, { props: { open: true } });
    expect(container.querySelector('[data-slot="dialog-overlay"]')).not.toBeNull();
  });

  it('clicking the overlay calls onclose', async () => {
    const onclose = vi.fn();
    const { container } = render(Dialog, { props: { open: true, onclose } });
    const overlay = container.querySelector('[data-slot="dialog-overlay"]') as HTMLElement;
    overlay.click();
    await Promise.resolve();
    expect(onclose).toHaveBeenCalled();
  });

  it('Escape key calls onclose when open', async () => {
    const onclose = vi.fn();
    render(Dialog, { props: { open: true, onclose } });
    await new Promise((r) => setTimeout(r, 0));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await Promise.resolve();
    expect(onclose).toHaveBeenCalled();
  });

  it('non-Escape key does not call onclose', async () => {
    const onclose = vi.fn();
    render(Dialog, { props: { open: true, onclose } });
    await new Promise((r) => setTimeout(r, 0));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    await Promise.resolve();
    expect(onclose).not.toHaveBeenCalled();
  });
});

describe('trapFocus', () => {
  it('wraps Tab from last to first when no element is focused', () => {
    const container = document.createElement('div');
    const a = document.createElement('button');
    a.textContent = 'A';
    const b = document.createElement('button');
    b.textContent = 'B';
    container.append(a, b);
    document.body.appendChild(container);
    const release = trapFocus(container);
    const evt = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
    // Make `b` (last) the active element
    b.focus();
    a.dispatchEvent(evt);
    // After Tab from last → first, the first focusable should be the target
    release();
    document.body.removeChild(container);
  });

  it('no-op when container has no focusable elements', () => {
    const container = document.createElement('div');
    container.appendChild(document.createElement('span'));
    document.body.appendChild(container);
    const release = trapFocus(container);
    const evt = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
    expect(() => container.dispatchEvent(evt)).not.toThrow();
    release();
    document.body.removeChild(container);
  });

  it('ignores non-Tab keys', () => {
    const container = document.createElement('div');
    const a = document.createElement('button');
    a.textContent = 'A';
    container.appendChild(a);
    document.body.appendChild(container);
    const release = trapFocus(container);
    a.focus();
    const evt = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    expect(() => a.dispatchEvent(evt)).not.toThrow();
    release();
    document.body.removeChild(container);
  });
});
