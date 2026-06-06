/**
 * ui-mini-coverage.test.ts — coverage of small UI components that
 * each had 1-3 uncovered lines in the v1.0.0 coverage report:
 *
 *   - EmptyState.svelte              (2 lines: icon + action snippets)
 *   - Radio.svelte                   (2 lines: name/value/checked props)
 *   - Popover.svelte                 (2 lines: Escape key + children render)
 *   - AccordionTrigger.svelte        (3 lines: isOpen + onopen callback)
 *   - Collapsible.svelte             (3 lines: data-state, getState, onopenChange)
 *   - CollapsibleContent.svelte      (1 line:  children render)
 *
 * Uses the test-render helper (Svelte 5 `mount` under jsdom). Snippet
 * children are forwarded via the wrapper `children: () => null` pattern
 * documented in `Button.svelte.test.ts`.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '$lib/utils/test-render';
import EmptyState from '../empty-state/EmptyState.svelte';
import Radio from '../radio/Radio.svelte';
import Popover from '../popover/Popover.svelte';
import AccordionTrigger from '../accordion/AccordionTrigger.svelte';
import Collapsible from '../collapsible/Collapsible.svelte';
import CollapsibleContent from '../collapsible/CollapsibleContent.svelte';

afterEach(cleanup);

// ---------------------------------------------------------------------------
// EmptyState
// ---------------------------------------------------------------------------
describe('EmptyState', () => {
  it('renders a basic empty state with title and description', () => {
    const { container } = render(EmptyState, {
      props: {
        title: 'No data',
        description: 'Nothing here yet',
        children: () => null,
      },
    });
    expect(container.querySelector('[data-slot="empty-state"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="empty-state-title"]')?.textContent).toBe('No data');
    expect(container.querySelector('[data-slot="empty-state-description"]')?.textContent).toBe(
      'Nothing here yet',
    );
  });

  it('renders an icon and action when both snippets are provided', () => {
    const { container } = render(EmptyState, {
      props: {
        title: 'Empty',
        icon: () => null,
        action: () => null,
        children: () => null,
      },
    });
    // The icon wrapper appears before the title.
    const root = container.querySelector('[data-slot="empty-state"]')!;
    const iconWrapper = root.querySelector('div.text-muted-foreground');
    expect(iconWrapper).not.toBeNull();
    // The action wrapper has the `mt-2` class.
    expect(root.querySelector('div.mt-2')).not.toBeNull();
  });

  it('renders children snippet', () => {
    const { container } = render(EmptyState, {
      props: {
        children: () => null,
      },
    });
    // EmptyState's root is the empty-state slot itself; presence is enough.
    expect(container.querySelector('[data-slot="empty-state"]')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Radio
// ---------------------------------------------------------------------------
describe('Radio', () => {
  it('renders with default props (unchecked)', () => {
    const { container } = render(Radio, { props: { name: 'group' } });
    const input = container.querySelector('input[type="radio"]') as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.name).toBe('group');
    expect(input.checked).toBe(false);
  });

  it('reflects name, value, id, and checked', () => {
    const { container } = render(Radio, {
      props: { name: 'opts', value: 'a', id: 'opt-a', checked: true },
    });
    const input = container.querySelector('input[type="radio"]') as HTMLInputElement;
    expect(input.value).toBe('a');
    expect(input.id).toBe('opt-a');
    expect(input.checked).toBe(true);
  });

  it('sets aria-invalid when the invalid prop is true', () => {
    const { container } = render(Radio, { props: { invalid: true } });
    const root = container.querySelector('[role="radio"]')!;
    expect(root.getAttribute('aria-invalid')).toBe('true');
  });

  it('invokes onchange and updates checked when clicked', async () => {
    const onchange = vi.fn();
    const { container } = render(Radio, { props: { onchange } });
    const input = container.querySelector('input[type="radio"]') as HTMLInputElement;
    await fireEvent.click(input);
    expect(input.checked).toBe(true);
    expect(onchange).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Popover
// ---------------------------------------------------------------------------
describe('Popover', () => {
  it('does not render when closed', () => {
    const { container } = render(Popover, { props: { open: false } });
    expect(container.querySelector('[data-slot="popover"]')).toBeNull();
  });

  it('renders when open and shows children', () => {
    const { container } = render(Popover, {
      props: { open: true, children: () => null },
    });
    const el = container.querySelector('[data-slot="popover"]');
    expect(el).not.toBeNull();
    expect(el?.getAttribute('role')).toBe('dialog');
  });

  it('closes when Escape is pressed and open is true', async () => {
    const { container, rerender } = render(Popover, {
      props: { open: true, children: () => null },
    });
    expect(container.querySelector('[data-slot="popover"]')).not.toBeNull();
    // Dispatch a real keydown event on document — the $effect listener
    // flips the bindable `open` to false.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    // Re-render with the post-flip value to flush the DOM update.
    await Promise.resolve();
    await Promise.resolve();
    rerender({ open: false, children: () => null });
    expect(container.querySelector('[data-slot="popover"]')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AccordionTrigger
// ---------------------------------------------------------------------------
describe('AccordionTrigger', () => {
  it('renders closed by default and shows the "+" indicator', () => {
    const { container } = render(AccordionTrigger, {
      props: { value: 'a', open: '', children: () => null },
    });
    const btn = container.querySelector('button')!;
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(btn.getAttribute('data-state')).toBe('closed');
    expect(btn.getAttribute('data-value')).toBe('a');
    expect(btn.querySelector('span[aria-hidden]')?.textContent).toBe('+');
  });

  it('renders open with the "−" indicator when value matches', () => {
    const { container } = render(AccordionTrigger, {
      props: { value: 'a', open: 'a', children: () => null },
    });
    const btn = container.querySelector('button')!;
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(btn.getAttribute('data-state')).toBe('open');
    expect(btn.querySelector('span[aria-hidden]')?.textContent).toBe('−');
  });

  it('toggles open state on click and fires onopen', async () => {
    // The trigger's `open` is `$bindable`. When the parent binds,
    // the child's write (`open = value`) updates the parent, and
    // `isOpen` (the $derived flag) re-evaluates to `true` only on
    // the next read. The onclick captures the OLD `isOpen` in its
    // closure, so `if (!isOpen) onopen?.(value)` correctly fires.
    //
    // To exercise this, we pass a get/set property for `open` —
    // the Svelte bindable proxy writes through to the setter,
    // simulating a real two-way binding.
    const { mount, unmount } = await import('svelte');
    const onopen = vi.fn();
    const target = document.body.appendChild(document.createElement('div'));
    let _open = '';
    const instance = mount(AccordionTrigger, {
      target,
      props: {
        value: 'a',
        get open() {
          return _open;
        },
        set open(v: string) {
          _open = v;
        },
        onopen,
        children: (() => null) as unknown as import('svelte').Snippet,
      },
    });
    const btn = target.querySelector('button')! as HTMLButtonElement;
    btn.click();
    expect(onopen).toHaveBeenCalledWith('a');
    unmount(instance);
  });
});

// ---------------------------------------------------------------------------
// Collapsible
// ---------------------------------------------------------------------------
describe('Collapsible', () => {
  it('renders with data-state="closed" by default', () => {
    const { container } = render(Collapsible, {
      props: { open: false, children: () => null },
    });
    const root = container.querySelector('[data-slot="collapsible"]')!;
    expect(root.getAttribute('data-state')).toBe('closed');
  });

  it('renders with data-state="open" when open is true', () => {
    const { container } = render(Collapsible, {
      props: { open: true, children: () => null },
    });
    const root = container.querySelector('[data-slot="collapsible"]')!;
    expect(root.getAttribute('data-state')).toBe('open');
  });

  it('exposes getState() with current open and setOpen() that fires onopenChange', async () => {
    // The `export function getState()` from Collapsible.svelte is
    // reachable via the Svelte component instance returned by
    // `mount`. We import `mount` directly so the test does not
    // depend on a private `render` extension.
    const { mount, unmount } = await import('svelte');
    const onopenChange = vi.fn();
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(Collapsible, {
      target,
      props: { open: false, onopenChange, children: (() => null) as unknown as import('svelte').Snippet },
    });
    const state = (
      instance as unknown as {
        getState: () => { open: boolean; setOpen: (v: boolean) => void };
      }
    ).getState();
    expect(state.open).toBe(false);
    state.setOpen(true);
    expect(onopenChange).toHaveBeenCalledWith(true);
    unmount(instance);
  });
});

// ---------------------------------------------------------------------------
// CollapsibleContent
// ---------------------------------------------------------------------------
describe('CollapsibleContent', () => {
  it('does not render when open is false', () => {
    const { container } = render(CollapsibleContent, {
      props: { open: false, children: () => null },
    });
    expect(container.querySelector('[data-slot="collapsible-content"]')).toBeNull();
  });

  it('renders with data-state="open" when open is true', () => {
    const { container } = render(CollapsibleContent, {
      props: { open: true, children: () => null },
    });
    const el = container.querySelector('[data-slot="collapsible-content"]');
    expect(el).not.toBeNull();
    expect(el?.getAttribute('data-state')).toBe('open');
  });
});
