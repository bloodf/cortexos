/**
 * sheet-mount.test.ts — coverage of Sheet.svelte via Svelte 5 mount.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '$lib/utils/test-render';
import Sheet from '../Sheet.svelte';

afterEach(() => cleanup());

describe('Sheet.svelte — mount', () => {
  it('renders nothing when open=false', () => {
    const { container } = render(Sheet, { props: { open: false } });
    const sheet = container.querySelector('[data-slot="sheet"]');
    expect(sheet).toBeNull();
  });

  it('renders the data-slot root when open=true', () => {
    const { container } = render(Sheet, { props: { open: true } });
    const sheet = container.querySelector('[data-slot="sheet"]');
    expect(sheet).not.toBeNull();
  });

  it('defaults side to right', () => {
    const { container } = render(Sheet, { props: { open: true } });
    const sheet = container.querySelector('[data-slot="sheet"]');
    expect(sheet?.getAttribute('data-side')).toBe('right');
  });

  it('respects an explicit side=left', () => {
    const { container } = render(Sheet, { props: { open: true, side: 'left' } });
    expect(container.querySelector('[data-slot="sheet"]')?.getAttribute('data-side')).toBe('left');
  });

  it('respects side=bottom', () => {
    const { container } = render(Sheet, { props: { open: true, side: 'bottom' } });
    expect(container.querySelector('[data-slot="sheet"]')?.getAttribute('data-side')).toBe('bottom');
  });

  it('respects side=top', () => {
    const { container } = render(Sheet, { props: { open: true, side: 'top' } });
    expect(container.querySelector('[data-slot="sheet"]')?.getAttribute('data-side')).toBe('top');
  });

  it('applies the className prop on the content panel', () => {
    const { container } = render(Sheet, { props: { open: true, class: 'custom-panel' } });
    const content = container.querySelector('[data-slot="sheet-content"]');
    expect(content?.className).toContain('custom-panel');
  });

  it('renders the overlay panel', () => {
    const { container } = render(Sheet, { props: { open: true } });
    expect(container.querySelector('[data-slot="sheet-overlay"]')).not.toBeNull();
  });

  it('clicking the overlay closes the sheet (calls onclose)', async () => {
    const onclose = vi.fn();
    const { container } = render(Sheet, { props: { open: true, onclose } });
    const overlay = container.querySelector('[data-slot="sheet-overlay"]') as HTMLElement;
    overlay.click();
    // flush microtasks for the $effect cleanup to fire
    await Promise.resolve();
    expect(onclose).toHaveBeenCalled();
  });

  it('Escape key closes the sheet (calls onclose)', async () => {
    const onclose = vi.fn();
    render(Sheet, { props: { open: true, onclose } });
    // Wait for $effect to register the global keydown listener.
    await new Promise((r) => setTimeout(r, 0));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await Promise.resolve();
    expect(onclose).toHaveBeenCalled();
  });

  it('non-Escape key does not close the sheet', async () => {
    const onclose = vi.fn();
    render(Sheet, { props: { open: true, onclose } });
    await new Promise((r) => setTimeout(r, 0));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    await Promise.resolve();
    expect(onclose).not.toHaveBeenCalled();
  });

  it('Escape on a closed sheet is a no-op', async () => {
    const onclose = vi.fn();
    render(Sheet, { props: { open: false, onclose } });
    await new Promise((r) => setTimeout(r, 0));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await Promise.resolve();
    expect(onclose).not.toHaveBeenCalled();
  });
});
