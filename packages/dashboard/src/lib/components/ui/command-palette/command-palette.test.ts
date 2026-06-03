import { describe, it, expect, afterEach, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, cleanup } from '../../../utils/test-render';
import CommandPalette from './CommandPalette.svelte';
import type { Command } from './CommandPalette.svelte';

const commands: Command[] = [
  { id: 'save', label: 'Save', shortcut: '⌘S', onselect: vi.fn() },
  { id: 'open', label: 'Open file', description: 'Open an existing file', onselect: vi.fn() },
  { id: 'settings', label: 'Settings', onselect: vi.fn() },
];

describe('CommandPalette', () => {
  afterEach(() => {
    commands.forEach((c) => (c.onselect as ReturnType<typeof vi.fn>).mockClear());
    cleanup();
  });

  it('does not render when closed', () => {
    const { container } = render(CommandPalette, { props: { open: false, commands } });
    expect(container.querySelector('[data-slot="command-palette"]')).toBeNull();
  });

  it('renders a search input and command list when open', () => {
    const { container } = render(CommandPalette, { props: { open: true, commands } });
    expect(container.querySelector('[data-slot="command-palette-input"]')).not.toBeNull();
    expect(container.querySelectorAll('[data-slot="command-palette-item"]').length).toBe(3);
  });

  it('filters commands by label substring (case-insensitive)', async () => {
    const user = userEvent.setup();
    const { container } = render(CommandPalette, { props: { open: true, commands } });
    const input = container.querySelector('input')!;
    await user.type(input, 'open');
    expect(container.querySelectorAll('[data-slot="command-palette-item"]').length).toBe(1);
    expect(container.textContent).toContain('Open file');
  });

  it('shows an empty state when nothing matches', async () => {
    const user = userEvent.setup();
    const { container } = render(CommandPalette, { props: { open: true, commands } });
    const input = container.querySelector('input')!;
    await user.type(input, 'zzz');
    expect(container.querySelector('[data-slot="command-palette-empty"]')).not.toBeNull();
  });

  it('pressing Enter triggers the active command and closes', async () => {
    const user = userEvent.setup();
    const { container } = render(CommandPalette, { props: { open: true, commands } });
    const input = container.querySelector('input')!;
    input.focus();
    await user.keyboard('{Enter}');
    expect(commands[0].onselect).toHaveBeenCalledTimes(1);
    // Palette is closed by select → should be gone from DOM.
    expect(container.querySelector('[data-slot="command-palette"]')).toBeNull();
  });

  it('ArrowDown moves the active item', async () => {
    const user = userEvent.setup();
    const { container } = render(CommandPalette, { props: { open: true, commands } });
    const input = container.querySelector('input')!;
    input.focus();
    await user.keyboard('{ArrowDown}');
    const items = container.querySelectorAll('[data-slot="command-palette-item"]');
    expect(items[1].getAttribute('data-state')).toBe('active');
  });

  it('ArrowUp wraps to the last item from the first', async () => {
    const user = userEvent.setup();
    const { container } = render(CommandPalette, { props: { open: true, commands } });
    const input = container.querySelector('input')!;
    input.focus();
    await user.keyboard('{ArrowUp}');
    const items = container.querySelectorAll('[data-slot="command-palette-item"]');
    expect(items[items.length - 1].getAttribute('data-state')).toBe('active');
  });

  it('Escape closes the palette', async () => {
    const user = userEvent.setup();
    const { container } = render(CommandPalette, { props: { open: true, commands } });
    const input = container.querySelector('input')!;
    input.focus();
    await user.keyboard('{Escape}');
    expect(container.querySelector('[data-slot="command-palette"]')).toBeNull();
  });
});
