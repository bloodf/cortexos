/**
 * toast-mount.test.ts — coverage of Toast.svelte + useToaster.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '$lib/utils/test-render';
import Toast, { useToaster, type Toast as ToastT } from '../Toast.svelte';

afterEach(() => cleanup());

const baseToast: ToastT = {
  id: 't-1',
  title: 'Hello',
  description: 'A test toast',
  variant: 'default',
  durationMs: 0, // don't auto-dismiss in tests
};

describe('Toast.svelte — mount', () => {
  it('renders the data-slot root with role=status', () => {
    const { container } = render(Toast, { props: { toast: baseToast } });
    const root = container.querySelector('[data-slot="toast"]');
    expect(root).not.toBeNull();
    expect(root?.getAttribute('role')).toBe('status');
    expect(root?.getAttribute('aria-live')).toBe('polite');
  });

  it('renders the title', () => {
    const { container } = render(Toast, { props: { toast: baseToast } });
    const title = container.querySelector('[data-slot="toast-title"]');
    expect(title?.textContent).toBe('Hello');
  });

  it('renders the description when present', () => {
    const { container } = render(Toast, { props: { toast: baseToast } });
    const desc = container.querySelector('[data-slot="toast-description"]');
    expect(desc?.textContent).toBe('A test toast');
  });

  it('omits the description when not present', () => {
    const { container } = render(Toast, {
      props: { toast: { ...baseToast, description: undefined } },
    });
    const desc = container.querySelector('[data-slot="toast-description"]');
    expect(desc).toBeNull();
  });

  it('invokes ondismiss when the dismiss button is clicked', () => {
    const ondismiss = vi.fn();
    const { container } = render(Toast, { props: { toast: baseToast, ondismiss } });
    const btn = container.querySelector('button[aria-label="Dismiss"]') as HTMLElement;
    btn.click();
    expect(ondismiss).toHaveBeenCalled();
  });

  it('renders without ondismiss handler without crashing', () => {
    const { container } = render(Toast, { props: { toast: baseToast } });
    const btn = container.querySelector('button[aria-label="Dismiss"]') as HTMLElement;
    expect(() => btn.click()).not.toThrow();
  });
});

describe('useToaster', () => {
  it('push adds a toast to the store with defaults', () => {
    const t = useToaster();
    let captured: ToastT[] = [];
    const unsub = t.subscribe((q) => (captured = q));
    t.clear();
    const id = t.push({ title: 'New' });
    expect(captured).toHaveLength(1);
    expect(captured[0]?.title).toBe('New');
    expect(captured[0]?.variant).toBe('default');
    expect(captured[0]?.durationMs).toBe(4000);
    expect(captured[0]?.id).toBe(id);
    unsub();
  });

  it('dismiss removes the toast by id', () => {
    const t = useToaster();
    t.clear();
    const id = t.push({ title: 'To remove' });
    t.dismiss(id);
    let captured: ToastT[] = [];
    const unsub = t.subscribe((q) => (captured = q));
    unsub();
    expect(captured.find((x) => x.id === id)).toBeUndefined();
  });

  it('clear empties the store', () => {
    const t = useToaster();
    t.push({ title: 'a' });
    t.push({ title: 'b' });
    t.clear();
    let captured: ToastT[] = [];
    const unsub = t.subscribe((q) => (captured = q));
    unsub();
    expect(captured).toHaveLength(0);
  });

  it('uses a caller-provided id when given', () => {
    const t = useToaster();
    t.clear();
    const id = t.push({ id: 'custom-id', title: 'X' });
    expect(id).toBe('custom-id');
  });
});
