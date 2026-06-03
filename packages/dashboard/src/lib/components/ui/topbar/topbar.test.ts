import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '../../../utils/test-render';
import Topbar from './Topbar.svelte';

describe('Topbar', () => {
  afterEach(cleanup);

  it('renders a header', () => {
    const { container } = render(Topbar);
    expect(container.querySelector('[data-slot="topbar"]')).not.toBeNull();
  });
});
