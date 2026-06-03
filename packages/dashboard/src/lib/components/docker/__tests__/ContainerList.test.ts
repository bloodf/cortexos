/**
 * ContainerList.test.ts — exercises the table view's column
 * rendering (name, image, state badge, status, ports) and the
 * empty state.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '../../../utils/test-render';
import ContainerList from '../ContainerList.svelte';
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

describe('ContainerList', () => {
  afterEach(cleanup);

  it('renders one row per container', () => {
    const containers = [
      makeContainer(),
      makeContainer({ name: 'prometheus-1', image: 'prom/prometheus:v2.55.0' }),
    ];
    const { container } = render(ContainerList, {
      props: { containers, messages: testMessages },
    });
    const rows = container.querySelectorAll('tbody [data-slot="table-row"]');
    expect(rows.length).toBe(2);
  });

  it('renders the column headers', () => {
    const { container } = render(ContainerList, {
      props: { containers: [makeContainer()], messages: testMessages },
    });
    expect(container.textContent).toContain('Name');
    expect(container.textContent).toContain('Image');
    expect(container.textContent).toContain('State');
    expect(container.textContent).toContain('Status');
    expect(container.textContent).toContain('Ports');
  });

  it('renders the state badge for each row', () => {
    const containers = [
      makeContainer({ state: 'running' }),
      makeContainer({ name: 'p2', state: 'exited' }),
    ];
    const { container } = render(ContainerList, {
      props: { containers, messages: testMessages },
    });
    const badges = container.querySelectorAll('[data-slot="container-state-badge"]');
    expect(badges.length).toBeGreaterThanOrEqual(2);
  });

  it('shows the DataTable empty state when there are no rows', () => {
    const { container } = render(ContainerList, {
      props: { containers: [], messages: testMessages },
    });
    expect(container.textContent).toContain('No results');
  });

  it('paginates with a small page size', () => {
    const containers = Array.from({ length: 6 }, (_, i) =>
      makeContainer({ name: `c-${i}` }),
    );
    const { container } = render(ContainerList, {
      props: { containers, pageSize: 2, messages: testMessages },
    });
    expect(container.textContent).toContain('Page 1 / 3');
  });
});
