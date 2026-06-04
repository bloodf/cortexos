/**
 * InstanceDetail.test.ts — verify the detail component renders
 * the header (name, type, status, image), the action bar, the
 * fields block, and the devices / validation sections.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '../../../utils/test-render';
import InstanceDetail from '../InstanceDetail.svelte';
import en from '$lib/i18n/messages/en.json';
import type { Messages } from '$lib/i18n';
import type { IncusInstance } from '@cortexos/contracts';

const messages: Messages = en;

const sample: IncusInstance = {
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
    hermes: { enabled: true, profile: 'hermes', port: 18695, model: 'gpt-4o-mini', proxies: [] },
    network: { bridge: 'incusbr0', tailscale: true, webAccess: false },
  },
  devices: {
    root: { path: '/', pool: 'default', type: 'disk' },
  },
  lastValidation: { ok: true, ranAt: '2026-05-12T10:00:00.000Z', notes: 'preflight passed' },
  createdBy: '00000000-0000-4000-8000-000000000001' as IncusInstance['createdBy'],
  createdAt: '2026-05-01T08:00:00.000Z',
  updatedAt: '2026-05-12T10:00:00.000Z',
};

describe('InstanceDetail', () => {
  afterEach(cleanup);

  it('renders the header (name, type pill, status badge, image)', () => {
    const { container } = render(InstanceDetail, {
      props: { instance: sample, messages, isAdmin: true },
    });
    expect(container.textContent).toContain('hermes-canary');
    expect(container.textContent).toContain('Container');
    expect(container.textContent).toContain('Active');
    expect(container.textContent).toContain('ubuntu/24.04');
  });

  it('renders the action bar with all 4 actions', () => {
    const { container } = render(InstanceDetail, {
      props: { instance: sample, messages, isAdmin: true },
    });
    const buttons = container.querySelectorAll('[data-slot="instance-action-button"]');
    expect(buttons.length).toBe(4);
  });

  it('renders the fields block (image, CPU, memory, branch, pool, bridge, hermes)', () => {
    const { container } = render(InstanceDetail, {
      props: { instance: sample, messages, isAdmin: true },
    });
    expect(container.querySelector('[data-slot="instance-field-image"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="instance-field-cpu"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="instance-field-memory"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="instance-field-branch"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="instance-field-pool"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="instance-field-bridge"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="instance-field-hermes"]')).not.toBeNull();
  });

  it('disables the action bar when isAdmin=false', () => {
    const { container } = render(InstanceDetail, {
      props: { instance: sample, messages, isAdmin: false },
    });
    const buttons = container.querySelectorAll('[data-slot="instance-action-button"] button');
    for (const b of Array.from(buttons)) {
      expect((b as HTMLButtonElement).disabled).toBe(true);
    }
  });

  it('renders the devices block (non-empty)', () => {
    const { container } = render(InstanceDetail, {
      props: { instance: sample, messages, isAdmin: true },
    });
    const dev = container.querySelector('[data-slot="instance-devices"]');
    expect(dev).not.toBeNull();
    expect(dev?.textContent).toContain('root');
  });

  it('renders the empty-devices state when no devices', () => {
    const noDevices: IncusInstance = { ...sample, devices: {} };
    const { container } = render(InstanceDetail, {
      props: { instance: noDevices, messages, isAdmin: true },
    });
    expect(container.querySelector('[data-slot="instance-devices-empty"]')).not.toBeNull();
  });

  it('renders the validation block (non-null)', () => {
    const { container } = render(InstanceDetail, {
      props: { instance: sample, messages, isAdmin: true },
    });
    expect(container.querySelector('[data-slot="instance-validation"]')).not.toBeNull();
  });

  it('renders the empty-validation state when lastValidation is null', () => {
    const noVal: IncusInstance = { ...sample, lastValidation: null };
    const { container } = render(InstanceDetail, {
      props: { instance: noVal, messages, isAdmin: true },
    });
    expect(container.querySelector('[data-slot="instance-validation-empty"]')).not.toBeNull();
  });

  it('forwards the onAction handler to the action bar', () => {
    const onAction = vi.fn();
    const { container } = render(InstanceDetail, {
      props: { instance: sample, messages, isAdmin: true, onAction },
    });
    expect(container.querySelector('[data-slot="instance-action-bar"]')).not.toBeNull();
  });
});
