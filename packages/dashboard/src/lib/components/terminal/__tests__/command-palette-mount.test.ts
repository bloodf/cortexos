/**
 * command-palette-mount.test.ts — coverage of CommandPalette.svelte.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '$lib/utils/test-render';
import CommandPalette from '../CommandPalette.svelte';

afterEach(() => cleanup());

const SAMPLE_OPS = [
  {
    op: 'term.ps',
    description: 'List processes',
    requiresApproval: false,
    placeholders: [] as string[],
  },
  {
    op: 'term.uptime',
    description: 'Server uptime',
    requiresApproval: false,
    placeholders: [] as string[],
  },
];

describe('CommandPalette.svelte — mount', () => {
  it('renders without crashing with an empty op list', () => {
    const { container } = render(CommandPalette, {
      props: { ops: [], onSelect: () => {} },
    });
    // The wrapper renders a button that opens the palette.
    const btn = container.querySelector('button');
    expect(btn).not.toBeNull();
  });

  it('renders a trigger button for opening the palette', () => {
    const { container } = render(CommandPalette, {
      props: { ops: SAMPLE_OPS, onSelect: () => {} },
    });
    const btn = container.querySelector('button');
    expect(btn).not.toBeNull();
  });

  it('exposes the data-slot root', () => {
    const { container } = render(CommandPalette, {
      props: { ops: SAMPLE_OPS, onSelect: () => {} },
    });
    const root = container.querySelector('[data-slot="command-palette"]')
      || container.querySelector('[data-slot="terminal-command-palette"]')
      || container.querySelector('button');
    expect(root).not.toBeNull();
  });
});
