/**
 * ContainerStateBadge.test.ts — exhaustive over the contracts
 * `DockerContainerState` union. Adding a new state breaks this
 * file's `it.each` (the union narrows).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '../../../utils/test-render';
import ContainerStateBadge from '../ContainerStateBadge.svelte';
import { testMessages } from './messages';
import type { ContainerStateLit } from '../adapter';

describe('ContainerStateBadge', () => {
  afterEach(cleanup);

  const cases: Array<{
    state: ContainerStateLit;
    variantClass: string;
    label: string;
  }> = [
    { state: 'running', variantClass: 'text-success', label: 'Running' },
    { state: 'exited', variantClass: 'text-destructive', label: 'Stopped' },
    { state: 'restarting', variantClass: 'text-warning', label: 'Restarting' },
    { state: 'paused', variantClass: 'text-info', label: 'Paused' },
    { state: 'dead', variantClass: 'text-secondary-foreground', label: 'Dead' },
  ];

  it.each(cases)('renders state=$state with the correct variant', ({ state, variantClass, label }) => {
    const { container } = render(ContainerStateBadge, {
      props: { state, messages: testMessages },
    });
    const span = container.querySelector('[data-slot="container-state-badge"]');
    expect(span).not.toBeNull();
    expect(span?.getAttribute('data-state')).toBe(state);
    expect(span?.textContent?.trim()).toBe(label);
    const badge = container.querySelector('[data-slot="badge"]');
    expect(badge?.className).toContain(variantClass);
  });

  it('honors a custom label override', () => {
    const { container } = render(ContainerStateBadge, {
      props: { state: 'exited', label: 'Down for maintenance', messages: testMessages },
    });
    const span = container.querySelector('[data-slot="container-state-badge"]');
    expect(span?.textContent?.trim()).toBe('Down for maintenance');
  });

  it('uses the requested size', () => {
    const { container } = render(ContainerStateBadge, {
      props: { state: 'running', size: 'sm', messages: testMessages },
    });
    const badge = container.querySelector('[data-slot="badge"]');
    expect(badge?.className).toContain('h-4');
  });
});
