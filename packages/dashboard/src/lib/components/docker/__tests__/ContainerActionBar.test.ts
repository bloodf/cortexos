/**
 * ContainerActionBar.test.ts — verifies the lifecycle action
 * bar renders the right buttons for a given state (PB-5: start
 * for exited/created, stop+restart for running, etc.) and that
 * the formaction attribute points at the right action.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '../../../utils/test-render';
import ContainerActionBar from '../ContainerActionBar.svelte';
import { FROZEN_NOW } from '../../../mocks/fixtures/seed';
import { adaptContainer } from '../adapter';
import type { DockerContainer } from '@cortexos/contracts';
import { testMessages } from './messages';

function makeContainer(overrides: Partial<Parameters<typeof adaptContainer>[0]> = {}): DockerContainer {
  return adaptContainer({
    id: 'sha256:abc123def456abc123def456abc123def456abc123def456abc123def456abcd',
    name: 'grafana-1',
    image: 'grafana/grafana:11.2.0',
    state: 'running',
    status: 'Up 2 hours',
    ports: ['3000:3000'],
    created: FROZEN_NOW,
    privileged: false,
    networks: ['monitoring'],
    mounts: [],
    ...overrides,
  });
}

describe('ContainerActionBar', () => {
  afterEach(cleanup);

  it('renders stop + restart + remove for a running container', () => {
    const { container } = render(ContainerActionBar, {
      props: { container: makeContainer({ state: 'running' }), messages: testMessages },
    });
    expect(container.querySelector('[data-slot="container-action-start"]')).toBeNull();
    expect(container.querySelector('[data-slot="container-action-stop"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="container-action-restart"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="container-action-remove"]')).not.toBeNull();
  });

  it('renders start + remove (no stop/restart) for an exited container', () => {
    const { container } = render(ContainerActionBar, {
      props: { container: makeContainer({ state: 'exited' }), messages: testMessages },
    });
    expect(container.querySelector('[data-slot="container-action-start"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="container-action-stop"]')).toBeNull();
    expect(container.querySelector('[data-slot="container-action-restart"]')).toBeNull();
    expect(container.querySelector('[data-slot="container-action-remove"]')).not.toBeNull();
  });

  it('renders start + restart + remove for a paused container', () => {
    const { container } = render(ContainerActionBar, {
      props: { container: makeContainer({ state: 'paused' }), messages: testMessages },
    });
    expect(container.querySelector('[data-slot="container-action-start"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="container-action-stop"]')).toBeNull();
    expect(container.querySelector('[data-slot="container-action-restart"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="container-action-remove"]')).not.toBeNull();
  });

  it('every button has type=submit and the right formaction', () => {
    const { container } = render(ContainerActionBar, {
      props: { container: makeContainer({ state: 'running' }), messages: testMessages },
    });
    const stop = container.querySelector(
      '[data-slot="container-action-stop"]',
    ) as HTMLButtonElement;
    expect(stop.type).toBe('submit');
    expect(stop.getAttribute('formaction')).toBe('?/stop');
    const restart = container.querySelector(
      '[data-slot="container-action-restart"]',
    ) as HTMLButtonElement;
    expect(restart.getAttribute('formaction')).toBe('?/restart');
    const remove = container.querySelector(
      '[data-slot="container-action-remove"]',
    ) as HTMLButtonElement;
    expect(remove.getAttribute('formaction')).toBe('?/remove');
  });

  it('disables the stop button when stopping=true', () => {
    const { container } = render(ContainerActionBar, {
      props: {
        container: makeContainer({ state: 'running' }),
        messages: testMessages,
        stopping: true,
      },
    });
    const stop = container.querySelector(
      '[data-slot="container-action-stop"]',
    ) as HTMLButtonElement;
    expect(stop.disabled).toBe(true);
    expect(stop.getAttribute('aria-busy')).toBe('true');
  });
});
