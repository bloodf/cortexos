import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '../../../utils/test-render';
import Alert from './Alert.svelte';

describe('Alert', () => {
  afterEach(cleanup);

  it('renders with role=alert', () => {
    const { container } = render(Alert);
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
  });

  it('applies variant styling', () => {
    const { container } = render(Alert, { props: { variant: 'error' } });
    expect(container.querySelector('[data-slot="alert"]')?.className).toContain('bg-destructive/10');
  });

  it('renders title slot when title prop is set', () => {
    const { container } = render(Alert, { props: { title: 'Oops' } });
    expect(container.querySelector('[data-slot="alert-title"]')?.textContent).toBe('Oops');
  });

  it('renders alert body slot', () => {
    const { container } = render(Alert);
    expect(container.querySelector('[data-slot="alert-description"]')).not.toBeNull();
  });
});
