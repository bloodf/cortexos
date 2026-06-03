import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '../../../utils/test-render';
import Toast, { useToaster } from './Toast.svelte';
import Toaster from './Toaster.svelte';

describe('Toast', () => {
  afterEach(() => {
    useToaster().clear();
    cleanup();
  });

  it('renders a single toast', () => {
    const t = { id: '1', title: 'Saved', variant: 'default' as const, durationMs: 0 };
    const { container } = render(Toast, { props: { toast: t } });
    const node = container.querySelector('[data-slot="toast"]');
    expect(node).not.toBeNull();
    expect(node?.textContent).toContain('Saved');
    expect(node).toHaveAttribute('role', 'status');
  });

  it('renders a success variant with the right classes', () => {
    const t = { id: '1', title: 'OK', variant: 'success' as const, durationMs: 0 };
    const { container } = render(Toast, { props: { toast: t } });
    const node = container.querySelector('[data-slot="toast"]');
    expect(node?.className).toContain('bg-success/10');
  });

  it('push() adds to the queue', () => {
    useToaster().clear();
    useToaster().push({ title: 'Hello' });
    const { container } = render(Toaster);
    expect(container.querySelectorAll('[data-slot="toast"]')).toHaveLength(1);
  });

  it('dismiss() removes from the queue', () => {
    useToaster().clear();
    const id = useToaster().push({ title: 'X', durationMs: 0 });
    useToaster().dismiss(id);
    const { container } = render(Toaster);
    expect(container.querySelectorAll('[data-slot="toast"]')).toHaveLength(0);
  });
});
