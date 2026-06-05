/**
 * accordion-trigger-mount.test.ts — coverage of AccordionTrigger.svelte.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '$lib/utils/test-render';
import AccordionTrigger from '../AccordionTrigger.svelte';

afterEach(() => cleanup());

describe('AccordionTrigger.svelte — mount', () => {
  it('renders the button with role=button', () => {
    const { container } = render(AccordionTrigger, {
      props: { value: 'item-1' },
    });
    const btn = container.querySelector('button');
    expect(btn).not.toBeNull();
    expect(btn?.getAttribute('type')).toBe('button');
  });

  it('reflects the value as data-value', () => {
    const { container } = render(AccordionTrigger, {
      props: { value: 'item-1' },
    });
    const btn = container.querySelector('button');
    expect(btn?.getAttribute('data-value')).toBe('item-1');
  });

  it('shows data-state=closed by default', () => {
    const { container } = render(AccordionTrigger, {
      props: { value: 'item-1' },
    });
    const btn = container.querySelector('button');
    expect(btn?.getAttribute('data-state')).toBe('closed');
  });

  it('shows data-state=open when open prop matches value', () => {
    const { container } = render(AccordionTrigger, {
      props: { value: 'item-1', open: 'item-1' },
    });
    const btn = container.querySelector('button');
    expect(btn?.getAttribute('data-state')).toBe('open');
    expect(btn?.getAttribute('aria-expanded')).toBe('true');
  });
});
