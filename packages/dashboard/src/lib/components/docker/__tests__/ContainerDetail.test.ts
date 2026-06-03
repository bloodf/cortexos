/**
 * ContainerDetail.test.ts — verifies the detail view renders
 * every section (header, inspect, action bar) and that the
 * privileged flag surfaces in the header.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '../../../utils/test-render';
import ContainerDetail from '../ContainerDetail.svelte';
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
    networks: ['monitoring', 'bridge'],
    mounts: [
      { source: 'grafana-data', destination: '/var/lib/grafana', mode: 'rw' },
    ],
    ...overrides,
  });
}

describe('ContainerDetail', () => {
  afterEach(cleanup);

  it('renders the container name, image, and the state badge', () => {
    const { container } = render(ContainerDetail, {
      props: { container: makeContainer(), messages: testMessages },
    });
    expect(container.textContent).toContain('grafana-1');
    expect(container.textContent).toContain('grafana/grafana:11.2.0');
    expect(container.querySelector('[data-slot="container-state-badge"]')).not.toBeNull();
  });

  it('renders the inspect + lifecycle sections', () => {
    const { container } = render(ContainerDetail, {
      props: { container: makeContainer(), messages: testMessages },
    });
    expect(container.textContent).toContain('Inspect');
    expect(container.textContent).toContain('Lifecycle');
  });

  it('shows a short id in the inspect section', () => {
    const { container } = render(ContainerDetail, {
      props: { container: makeContainer(), messages: testMessages },
    });
    const id = container.querySelector('[data-slot="container-detail-id"]');
    expect(id?.textContent).toMatch(/[a-f0-9]{12}…/);
  });

  it('shows the privileged badge when privileged=true', () => {
    const { container } = render(ContainerDetail, {
      props: {
        container: makeContainer({ privileged: true }),
        messages: testMessages,
      },
    });
    expect(container.textContent).toContain('PRIVILEGED');
    // And the inspect field says "Yes (--privileged)".
    expect(container.textContent).toContain('Yes (--privileged)');
  });

  it('shows the mount list in the inspect section', () => {
    const { container } = render(ContainerDetail, {
      props: {
        container: makeContainer({
          mounts: [{ source: 'data', destination: '/data', mode: 'rw' }],
        }),
        messages: testMessages,
      },
    });
    expect(container.textContent).toContain('data:/data');
  });
});
