/**
 * InstanceLogs.test.ts — verify the logs component renders row
 * count, priority data-attr, empty state, and column headers.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '../../../utils/test-render';
import InstanceLogs from '../InstanceLogs.svelte';
import en from '$lib/i18n/messages/en.json';
import type { Messages } from '$lib/i18n';
import type { IncusLogLine } from '$lib/server/incus/bridge';

const messages: Messages = en;

const SAMPLE_LOGS: IncusLogLine[] = [
  { ts: '2026-05-12T10:00:00.000Z', priority: 'info', name: 'hermes-canary', message: 'started' },
  { ts: '2026-05-12T10:00:01.000Z', priority: 'info', name: 'hermes-canary', message: 'image attached' },
  { ts: '2026-05-12T10:00:02.000Z', priority: 'warn', name: 'hermes-canary', message: 'disk slow' },
];

describe('InstanceLogs', () => {
  afterEach(cleanup);

  it('renders one row per log line', () => {
    const { container } = render(InstanceLogs, {
      props: {
        logs: SAMPLE_LOGS,
        messages,
        title: 'Logs',
        description: 'last lines',
        emptyLabel: 'no logs',
      },
    });
    const rows = container.querySelectorAll('[data-slot="instance-logs-row"]');
    expect(rows.length).toBe(SAMPLE_LOGS.length);
  });

  it('exposes the priority data-attr per row', () => {
    const { container } = render(InstanceLogs, {
      props: {
        logs: SAMPLE_LOGS,
        messages,
        title: 'Logs',
        description: 'last lines',
        emptyLabel: 'no logs',
      },
    });
    const rows = container.querySelectorAll('[data-slot="instance-logs-row"]');
    expect(rows[0]?.getAttribute('data-priority')).toBe('info');
    expect(rows[2]?.getAttribute('data-priority')).toBe('warn');
  });

  it('renders the column headers from i18n', () => {
    const { container } = render(InstanceLogs, {
      props: {
        logs: SAMPLE_LOGS,
        messages,
        title: 'Logs',
        description: 'last lines',
        emptyLabel: 'no logs',
      },
    });
    const headers = container.querySelectorAll('th');
    expect(headers.length).toBe(3);
    expect(headers[0]?.textContent).toBe('Timestamp');
    expect(headers[1]?.textContent).toBe('Priority');
    expect(headers[2]?.textContent).toBe('Message');
  });

  it('renders the empty state when logs is empty', () => {
    const { container } = render(InstanceLogs, {
      props: {
        logs: [],
        messages,
        title: 'Logs',
        description: 'last lines',
        emptyLabel: 'no logs yet',
      },
    });
    const empty = container.querySelector('[data-slot="instance-logs-empty"]');
    expect(empty).not.toBeNull();
    expect(empty?.textContent?.trim()).toBe('no logs yet');
  });
});
