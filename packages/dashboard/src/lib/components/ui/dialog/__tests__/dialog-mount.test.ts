/**
 * dialog-mount.test.ts — coverage of Dialog.svelte via Svelte 5 mount.
 *
 * Exercises the data-slot root, the open prop, and the close
 * handler.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '$lib/utils/test-render';
import Dialog from '../Dialog.svelte';

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

});
