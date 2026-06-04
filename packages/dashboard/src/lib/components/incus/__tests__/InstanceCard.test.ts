/**
 * InstanceCard.test.ts — verify the card renders name, image,
 * state badge, and CPU/memory; onSelect dispatch; non-interactive
 * when onSelect is absent.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '../../../utils/test-render';
import InstanceCard from '../InstanceCard.svelte';
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
  devices: {},
  lastValidation: null,
  createdBy: '00000000-0000-4000-8000-000000000001' as IncusInstance['createdBy'],
  createdAt: '2026-05-01T08:00:00.000Z',
  updatedAt: '2026-05-12T10:00:00.000Z',
};

describe('InstanceCard', () => {
  afterEach(cleanup);

  it('renders the name, image, state badge, and resources', () => {
    const { container } = render(InstanceCard, {
      props: { instance: sample, messages },
    });
    expect(container.textContent).toContain('hermes-canary');
    expect(container.textContent).toContain('ubuntu/24.04');
    expect(container.textContent).toContain('Active');
    expect(container.textContent).toContain('Container');
    expect(container.textContent).toContain('2 vCPU');
    expect(container.textContent).toContain('4.0 GiB');
  });

  it('exposes the data-slot + data-instance-name', () => {
    const { container } = render(InstanceCard, {
      props: { instance: sample, messages },
    });
    const card = container.querySelector('[data-slot="instance-card"]');
    expect(card).not.toBeNull();
    expect(card?.getAttribute('data-instance-name')).toBe('hermes-canary');
  });

  it('dispatches onSelect with the instance on click', async () => {
    const onSelect = vi.fn();
    const { container } = render(InstanceCard, {
      props: { instance: sample, messages, onSelect },
    });
    const card = container.querySelector('[data-slot="instance-card"]') as HTMLElement;
    await fireEvent.click(card);
    expect(onSelect).toHaveBeenCalledWith(sample);
  });

  it('dispatches onSelect on Enter key', async () => {
    const onSelect = vi.fn();
    const { container } = render(InstanceCard, {
      props: { instance: sample, messages, onSelect },
    });
    const card = container.querySelector('[data-slot="instance-card"]') as HTMLElement;
    await fireEvent.keyDown(card, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith(sample);
  });

  it('is non-interactive when onSelect is absent (no role=button)', () => {
    const { container } = render(InstanceCard, {
      props: { instance: sample, messages },
    });
    const card = container.querySelector('[data-slot="instance-card"]') as HTMLElement;
    expect(card.getAttribute('role')).not.toBe('button');
    expect(card.getAttribute('tabindex')).toBeNull();
  });

  it('handles a stopped-state instance (no CPU/memory shown when null)', () => {
    const stopped: IncusInstance = { ...sample, status: 'stopped', cpu: null, memory: null };
    const { container } = render(InstanceCard, {
      props: { instance: stopped, messages },
    });
    expect(container.textContent).toContain('Stopped');
    expect(container.textContent).toContain('—');
  });
});
