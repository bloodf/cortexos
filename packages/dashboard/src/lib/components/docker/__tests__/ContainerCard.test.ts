/**
 * ContainerCard.test.ts — verifies the card renders the
 * container's name, monogram, image, state badge, and ports.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '../../../utils/test-render';
import ContainerCard from '../ContainerCard.svelte';
import { FROZEN_NOW } from '../../../mocks/fixtures/seed';
import { adaptContainer } from '../adapter';
import type { DockerContainer } from '@cortexos/contracts';
import { testMessages } from './messages';

function makeFixture(overrides: Partial<Parameters<typeof adaptContainer>[0]> = {}): DockerContainer {
  return adaptContainer({
    id: 'sha256:abc123def456abc123def456abc123def456abc123def456abc123def456abcd',
    name: 'grafana-1',
    image: 'grafana/grafana:11.2.0',
    state: 'running',
    status: 'Up 2 hours',
    ports: ['3000:3000', '9090:9090'],
    created: FROZEN_NOW,
    privileged: false,
    networks: ['monitoring'],
    mounts: [],
    ...overrides,
  });
}

describe('ContainerCard', () => {
  afterEach(cleanup);

  it('renders the container name, monogram, and image', () => {
    const { container } = render(ContainerCard, {
      props: { container: makeFixture(), messages: testMessages },
    });
    expect(container.textContent).toContain('grafana-1');
    expect(container.textContent).toContain('grafana/grafana:11.2.0');
    const card = container.querySelector('[data-slot="container-card"]');
    expect(card?.getAttribute('data-container-name')).toBe('grafana-1');
    const icon = container.querySelector('[data-slot="container-icon"]');
    expect(icon?.textContent?.trim()).toBe('GR');
  });

  it('renders the port list', () => {
    const { container } = render(ContainerCard, {
      props: { container: makeFixture(), messages: testMessages },
    });
    const ports = container.querySelector('[data-slot="container-ports"]');
    expect(ports?.textContent).toContain('3000:3000');
    expect(ports?.textContent).toContain('9090:9090');
  });

  it('falls back to em-dash when there are no ports', () => {
    const { container } = render(ContainerCard, {
      props: {
        container: makeFixture({ ports: [] }),
        messages: testMessages,
      },
    });
    const ports = container.querySelector('[data-slot="container-ports"]');
    expect(ports?.textContent?.trim()).toBe('—');
  });

  it('invokes onSelect when the card is clicked', () => {
    const calls: DockerContainer[] = [];
    const { container } = render(ContainerCard, {
      props: {
        container: makeFixture(),
        messages: testMessages,
        onSelect: (c: DockerContainer) => {
          calls.push(c);
        },
      },
    });
    const interactive = container.querySelector('[data-slot="container-card"]') as HTMLElement | null;
    interactive?.click();
    expect(calls).toHaveLength(1);
    expect(calls[0]?.name).toBe('grafana-1');
  });

  it('does not render as a button when onSelect is omitted', () => {
    const { container } = render(ContainerCard, {
      props: { container: makeFixture(), messages: testMessages },
    });
    const card = container.querySelector('[data-slot="container-card"]');
    expect(card?.getAttribute('role')).toBeNull();
    expect(card?.getAttribute('tabindex')).toBeNull();
  });
});
