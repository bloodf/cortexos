/**
 * InstanceStateBadge.test.ts — exhaustive over the 9-state
 * `IncusStatusLit` union. Adding a state to the contracts package
 * forces a compile error in the badge component (the switch in
 * `stateVariant` is exhaustive), and these tests assert the visible
 * label + variant for every state.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '../../../utils/test-render';
import InstanceStateBadge from '../InstanceStateBadge.svelte';
import en from '$lib/i18n/messages/en.json';
import type { Messages } from '$lib/i18n';
import type { IncusStatusLit } from '../adapter';

const messages: Messages = en;

describe('InstanceStateBadge', () => {
  afterEach(cleanup);

  const cases: Array<{ state: IncusStatusLit; variantClass: string; label: string }> = [
    { state: 'draft', variantClass: 'text-foreground', label: 'Draft' },
    { state: 'validated', variantClass: 'text-foreground', label: 'Validated' },
    { state: 'provisioning', variantClass: 'text-info', label: 'Provisioning' },
    { state: 'active', variantClass: 'text-success', label: 'Active' },
    { state: 'failed', variantClass: 'text-destructive', label: 'Failed' },
    { state: 'running', variantClass: 'text-success', label: 'Running' },
    { state: 'stopped', variantClass: 'text-secondary-foreground', label: 'Stopped' },
    { state: 'frozen', variantClass: 'text-warning', label: 'Frozen' },
    { state: 'error', variantClass: 'text-destructive', label: 'Error' },
  ];

  it.each(cases)('renders state=$state with the correct variant', ({ state, variantClass, label }) => {
    const { container } = render(InstanceStateBadge, {
      props: { state, messages },
    });
    const span = container.querySelector('[data-slot="instance-state-badge"]');
    expect(span).not.toBeNull();
    expect(span?.getAttribute('data-state')).toBe(state);
    expect(span?.textContent?.trim()).toBe(label);
    const badge = container.querySelector('[data-slot="badge"]');
    expect(badge?.className).toContain(variantClass);
  });

  it('honors a custom label override', () => {
    const { container } = render(InstanceStateBadge, {
      props: { state: 'failed', label: 'crashed', messages },
    });
    const span = container.querySelector('[data-slot="instance-state-badge"]');
    expect(span?.textContent?.trim()).toBe('crashed');
  });

  it('uses the requested size', () => {
    const { container } = render(InstanceStateBadge, {
      props: { state: 'active', size: 'sm', messages },
    });
    const badge = container.querySelector('[data-slot="badge"]');
    expect(badge?.className).toContain('h-4');
  });
});
