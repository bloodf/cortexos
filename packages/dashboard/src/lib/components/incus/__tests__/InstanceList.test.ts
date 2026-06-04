/**
 * InstanceList.test.ts — verify the DataTable-backed list renders
 * rows, headers, and an empty state.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '../../../utils/test-render';
import InstanceList from '../InstanceList.svelte';
import en from '$lib/i18n/messages/en.json';
import type { Messages } from '$lib/i18n';
import type { IncusInstance } from '@cortexos/contracts';

const messages: Messages = en;

const SEED: IncusInstance[] = [
  {
    name: 'hermes-canary',
    slug: 'hermes-canary',
    status: 'active',
    type: 'container',
    image: 'ubuntu/24.04',
    cpu: 2,
    memory: 4096,
    config: {
      target: { mode: 'new', branch: 'main', ghOrg: 'cortexos', slug: 'hermes-canary' },
      image: { alias: 'ubuntu/24.04', gastown: false, profiles: ['default'], pool: 'default' },
      hermes: { enabled: false, proxies: [] },
      network: { bridge: 'incusbr0', tailscale: true, webAccess: false },
    },
    devices: {},
    lastValidation: null,
    createdBy: '00000000-0000-4000-8000-000000000001' as IncusInstance['createdBy'],
    createdAt: '2026-05-01T08:00:00.000Z',
    updatedAt: '2026-05-12T10:00:00.000Z',
  },
  {
    name: 'paperclip-relay',
    slug: 'paperclip-relay',
    status: 'provisioning',
    type: 'vm',
    image: 'debian/12',
    cpu: 4,
    memory: 8192,
    config: {
      target: { mode: 'new', branch: 'main', ghOrg: 'cortexos', slug: 'paperclip-relay' },
      image: { alias: 'debian/12', gastown: false, profiles: ['nested'], pool: 'nvme' },
      hermes: { enabled: false, proxies: [] },
      network: { bridge: 'incusbr0', tailscale: true, webAccess: true },
    },
    devices: {},
    lastValidation: null,
    createdBy: '00000000-0000-4000-8000-000000000002' as IncusInstance['createdBy'],
    createdAt: '2026-05-15T14:30:00.000Z',
    updatedAt: '2026-05-15T14:30:00.000Z',
  },
];

describe('InstanceList', () => {
  afterEach(cleanup);

  it('renders one row per instance', () => {
    const { container } = render(InstanceList, {
      props: { instances: SEED, messages },
    });
    // The DataTable primitive renders <tr data-slot="data-table-row">
    const rows = container.querySelectorAll('[data-slot="data-table-row"]');
    expect(rows.length).toBe(SEED.length);
  });

  it('renders the column headers from i18n', () => {
    const { container } = render(InstanceList, {
      props: { instances: SEED, messages },
    });
    const headers = container.querySelectorAll('[data-slot="data-table-header-cell"]');
    expect(headers.length).toBeGreaterThanOrEqual(5);
    const headerText = Array.from(headers).map((h) => h.textContent?.trim());
    expect(headerText).toContain('Name');
    expect(headerText).toContain('Type');
    expect(headerText).toContain('Image');
    expect(headerText).toContain('Status');
  });

  it('renders an empty state when the list is empty', () => {
    const { container } = render(InstanceList, {
      props: { instances: [], messages },
    });
    // DataTable shows an empty message slot.
    const empty = container.querySelector('[data-slot="data-table-empty"]');
    expect(empty).not.toBeNull();
  });

  it('exposes the data-slot=instance-list', () => {
    const { container } = render(InstanceList, {
      props: { instances: SEED, messages },
    });
    const list = container.querySelector('[data-slot="instance-list"]');
    expect(list).not.toBeNull();
  });

  it('renders the status badge per row', () => {
    const { container } = render(InstanceList, {
      props: { instances: SEED, messages },
    });
    const badges = container.querySelectorAll('[data-slot="instance-state-badge"]');
    expect(badges.length).toBe(SEED.length);
    expect(badges[0]?.getAttribute('data-state')).toBe('active');
    expect(badges[1]?.getAttribute('data-state')).toBe('provisioning');
  });

  it('renders CPU + memory cells', () => {
    const { container } = render(InstanceList, {
      props: { instances: SEED, messages },
    });
    expect(container.textContent).toContain('2 vCPU');
    expect(container.textContent).toContain('4 vCPU');
    expect(container.textContent).toContain('4.0 GiB');
    expect(container.textContent).toContain('8.0 GiB');
  });
});
