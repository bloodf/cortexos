import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '../../../utils/test-render';
import Sheet from './Sheet.svelte';
import SheetHeader from './SheetHeader.svelte';
import SheetBody from './SheetBody.svelte';
import SheetFooter from './SheetFooter.svelte';

describe('Sheet', () => {
  afterEach(cleanup);

  it('does not render when closed', () => {
    const { container } = render(Sheet, { props: { open: false, children: () => null } });
    expect(container.querySelector('[data-slot="sheet"]')).toBeNull();
  });

  it('renders when open', () => {
    const { container } = render(Sheet, { props: { open: true, children: () => null } });
    expect(container.querySelector('[data-slot="sheet"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="sheet-content"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="sheet-overlay"]')).not.toBeNull();
  });

  it('exposes a role=dialog', () => {
    const { container } = render(Sheet, { props: { open: true, children: () => null } });
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
  });

  it('forwards side to data-side attribute', () => {
    const { container } = render(Sheet, {
      props: { open: true, side: 'left', children: () => null },
    });
    expect(container.querySelector('[data-slot="sheet"]')?.getAttribute('data-side')).toBe('left');
  });

  it('SheetHeader renders its data-slot wrapper', () => {
    const { container } = render(SheetHeader, { props: { children: () => null } });
    expect(container.querySelector('[data-slot="sheet-header"]')).not.toBeNull();
  });

  it('SheetBody renders its data-slot wrapper', () => {
    const { container } = render(SheetBody, { props: { children: () => null } });
    expect(container.querySelector('[data-slot="sheet-body"]')).not.toBeNull();
  });

  it('SheetFooter renders its data-slot wrapper', () => {
    const { container } = render(SheetFooter, { props: { children: () => null } });
    expect(container.querySelector('[data-slot="sheet-footer"]')).not.toBeNull();
  });
});
