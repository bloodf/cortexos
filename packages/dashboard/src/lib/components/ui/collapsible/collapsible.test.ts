import { describe, it, expect, afterEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, cleanup } from '../../../utils/test-render';
import Collapsible from './Collapsible.svelte';
import CollapsibleTrigger from './CollapsibleTrigger.svelte';
import CollapsibleContent from './CollapsibleContent.svelte';

describe('Collapsible', () => {
  afterEach(cleanup);

  it('renders a wrapper with the closed state by default', () => {
    const { container } = render(Collapsible, { props: { children: () => null } });
    const root = container.querySelector('[data-slot="collapsible"]');
    expect(root).not.toBeNull();
    expect(root?.getAttribute('data-state')).toBe('closed');
  });

  it('shows open state when open=true', () => {
    const { container } = render(Collapsible, { props: { open: true, children: () => null } });
    const root = container.querySelector('[data-slot="collapsible"]');
    expect(root?.getAttribute('data-state')).toBe('open');
  });

  it('Trigger toggles via onopenChange', async () => {
    const user = userEvent.setup();
    let open = false;
    const { container } = render(CollapsibleTrigger, {
      props: { open, onopenChange: (v: boolean) => (open = v), children: () => 'Toggle' },
    });
    const btn = container.querySelector('button')!;
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    await user.click(btn);
    expect(open).toBe(true);
  });

  it('Trigger reflects the open state in aria-expanded', () => {
    const { container } = render(CollapsibleTrigger, {
      props: { open: true, onopenChange: () => {}, children: () => 'Toggle' },
    });
    const btn = container.querySelector('button')!;
    expect(btn.getAttribute('aria-expanded')).toBe('true');
  });

  it('Content only renders when open=true', () => {
    const { container: open } = render(CollapsibleContent, {
      props: { open: true, children: () => 'Hi' },
    });
    const { container: closed } = render(CollapsibleContent, {
      props: { open: false, children: () => 'Hi' },
    });
    expect(open.querySelector('[data-slot="collapsible-content"]')).not.toBeNull();
    expect(closed.querySelector('[data-slot="collapsible-content"]')).toBeNull();
  });
});
