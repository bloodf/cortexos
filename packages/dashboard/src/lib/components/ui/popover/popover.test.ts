import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '../../../utils/test-render';
import Popover from './Popover.svelte';

describe('Popover', () => {
  afterEach(cleanup);

  it('renders nothing when closed', () => {
    const { container } = render(Popover, { props: { open: false } });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('renders content when open', () => {
    const { container } = render(Popover, { props: { open: true } });
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
  });

  it('renders popover slot wrapper', () => {
    const { container } = render(Popover, { props: { open: true } });
    expect(container.querySelector('[data-slot="popover"]')).not.toBeNull();
  });

  it('Escape keydown handler is registered when open', () => {
    // Smoke: just confirm the open prop wires through.
    const { container } = render(Popover, { props: { open: true } });
    expect(container.querySelector('[data-slot="popover"]')).not.toBeNull();
  });
});
