import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '../../../utils/test-render';
import Tooltip from './Tooltip.svelte';

describe('Tooltip', () => {
  afterEach(cleanup);

  it('renders nothing when closed', () => {
    const { container } = render(Tooltip, { props: { open: false } });
    expect(container.querySelector('[role="tooltip"]')).toBeNull();
  });

  it('renders content when open', () => {
    const { container } = render(Tooltip, { props: { open: true } });
    expect(container.querySelector('[role="tooltip"]')).not.toBeNull();
  });

  it('renders tooltip slot wrapper', () => {
    const { container } = render(Tooltip, { props: { open: true } });
    expect(container.querySelector('[data-slot="tooltip"]')).not.toBeNull();
  });
});
