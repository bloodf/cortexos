/**
 * ContainerLogs.test.ts — verifies the read-only log view
 * renders the lines, the empty state, and the refresh button.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '../../../utils/test-render';
import ContainerLogs from '../ContainerLogs.svelte';
import { FROZEN_NOW } from '../../../mocks/fixtures/seed';
import { adaptContainer } from '../adapter';
import { testMessages } from './messages';

const fixture = adaptContainer({
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
});

describe('ContainerLogs', () => {
  afterEach(cleanup);

  it('renders the log lines in a <pre> block', () => {
    const { container } = render(ContainerLogs, {
      props: {
        container: fixture,
        messages: testMessages,
        lines: ['line 1', 'line 2', 'line 3'],
        tail: 100,
      },
    });
    const body = container.querySelector('[data-slot="container-logs-body"]');
    expect(body?.textContent).toContain('line 1');
    expect(body?.textContent).toContain('line 2');
    expect(body?.textContent).toContain('line 3');
  });

  it('shows the empty state when there are no lines', () => {
    const { container } = render(ContainerLogs, {
      props: {
        container: fixture,
        messages: testMessages,
        lines: [],
        tail: 100,
      },
    });
    expect(container.querySelector('[data-slot="container-logs-empty"]')).not.toBeNull();
  });

  it('shows the requested tail count in the header', () => {
    const { container } = render(ContainerLogs, {
      props: {
        container: fixture,
        messages: testMessages,
        lines: ['a', 'b'],
        tail: 50,
      },
    });
    const tail = container.querySelector('[data-slot="container-logs-tail"]');
    expect(tail?.textContent).toContain('50');
  });

  it('shows the line count in the header', () => {
    const { container } = render(ContainerLogs, {
      props: {
        container: fixture,
        messages: testMessages,
        lines: ['a', 'b', 'c', 'd', 'e'],
        tail: 100,
      },
    });
    const count = container.querySelector('[data-slot="container-logs-count"]');
    expect(count?.textContent).toContain('5');
  });

  it('invokes onRefresh when the refresh button is clicked', async () => {
    const onRefresh = vi.fn();
    const { container } = render(ContainerLogs, {
      props: {
        container: fixture,
        messages: testMessages,
        lines: ['a'],
        tail: 100,
        onRefresh,
      },
    });
    const btn = container.querySelector(
      '[data-slot="container-logs-refresh"]',
    ) as HTMLButtonElement;
    btn.click();
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it('renders an error banner when error is set', () => {
    const { container } = render(ContainerLogs, {
      props: {
        container: fixture,
        messages: testMessages,
        lines: [],
        tail: 100,
        error: 'No permission',
      },
    });
    const err = container.querySelector('[data-slot="container-logs-error"]');
    expect(err?.textContent).toContain('No permission');
  });
});
