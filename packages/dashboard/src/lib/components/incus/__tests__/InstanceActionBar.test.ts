/**
 * InstanceActionBar.test.ts — verify the action bar wires the
 * start/stop/restart/delete buttons + the destructive flag + the
 * admin-only disabled state + the onAction dispatch.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '../../../utils/test-render';
import InstanceActionBar from '../InstanceActionBar.svelte';
import en from '$lib/i18n/messages/en.json';
import type { Messages } from '$lib/i18n';

const messages: Messages = en;

describe('InstanceActionBar', () => {
  afterEach(cleanup);

  it('renders all 4 action buttons', () => {
    const { container } = render(InstanceActionBar, {
      props: { canAct: true, messages },
    });
    const buttons = container.querySelectorAll('[data-slot="instance-action-button"]');
    expect(buttons.length).toBe(4);
    const actions = Array.from(buttons).map((b) => b.getAttribute('data-action'));
    expect(actions).toEqual(['start', 'stop', 'restart', 'delete']);
  });

  it('flags destructive actions (stop, restart, delete)', () => {
    const { container } = render(InstanceActionBar, {
      props: { canAct: true, messages },
    });
    const stop = container.querySelector('[data-action="stop"]');
    expect(stop?.getAttribute('data-destructive')).toBe('true');
    const restart = container.querySelector('[data-action="restart"]');
    expect(restart?.getAttribute('data-destructive')).toBe('true');
    const del = container.querySelector('[data-action="delete"]');
    expect(del?.getAttribute('data-destructive')).toBe('true');
    const start = container.querySelector('[data-action="start"]');
    expect(start?.getAttribute('data-destructive')).toBe('false');
  });

  it('disables every button when canAct=false (admin-only)', () => {
    const { container } = render(InstanceActionBar, {
      props: { canAct: false, messages },
    });
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThan(0);
    for (const b of Array.from(buttons)) {
      expect((b as HTMLButtonElement).disabled).toBe(true);
    }
  });

  it('dispatches the action via onAction (positive case)', async () => {
    const onAction = vi.fn();
    const { container } = render(InstanceActionBar, {
      props: { canAct: true, messages, onAction },
    });
    const startBtn = container.querySelector(
      '[data-action="start"] button',
    ) as HTMLButtonElement | null;
    expect(startBtn).not.toBeNull();
    await fireEvent.click(startBtn!);
    expect(onAction).toHaveBeenCalledWith('start');
  });

  it('does not dispatch when canAct=false (negative case)', async () => {
    const onAction = vi.fn();
    const { container } = render(InstanceActionBar, {
      props: { canAct: false, messages, onAction },
    });
    const startBtn = container.querySelector(
      '[data-action="start"] button',
    ) as HTMLButtonElement | null;
    // Button is disabled; click should be a no-op for the handler.
    await fireEvent.click(startBtn!);
    expect(onAction).not.toHaveBeenCalled();
  });

  it('does not dispatch when pending=true', async () => {
    const onAction = vi.fn();
    const { container } = render(InstanceActionBar, {
      props: { canAct: true, messages, onAction, pending: true },
    });
    const startBtn = container.querySelector(
      '[data-action="start"] button',
    ) as HTMLButtonElement | null;
    expect((startBtn as HTMLButtonElement).disabled).toBe(true);
    await fireEvent.click(startBtn!);
    expect(onAction).not.toHaveBeenCalled();
  });
});
