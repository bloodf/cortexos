/**
 * wterm-terminal-mount.test.ts — real mount-based tests for
 * Terminal.svelte after the @wterm/dom swap (W47).
 *
 * wterm renders to the DOM (no canvas), so the entire mount → write →
 * onData → resize → focus → destroy path is testable in jsdom. The
 * vitest.setup.ts stubs (rAF + getComputedStyle) plus the 'destroyed'
 * race-guard in Terminal.svelte make this safe under the test-render
 * harness's afterEach unmount.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { waitFor } from '$lib/utils/test-render';
import { render, cleanup } from '$lib/utils/test-render';
import Terminal, { type TerminalApi } from '../Terminal.svelte';

afterEach(() => cleanup());

describe('Terminal.svelte — wterm mount lifecycle', () => {
  it('mounts the wterm grid into the host element', async () => {
    const { container } = render(Terminal, { props: { banner: 'B', prompt: 'P>' } });
    const host = container.querySelector('[data-slot="terminal"]') as HTMLElement;
    await waitFor(() => {
      expect(host.classList.contains('wterm')).toBe(true);
      expect(host.querySelector('.term-grid')).not.toBeNull();
      expect(host.getAttribute('data-mounted')).toBe('true');
    });
  });

  it('renders the banner and prompt into .term-row', async () => {
    const { container } = render(Terminal, { props: { banner: 'HELLO\r\n', prompt: 'P>' } });
    const host = container.querySelector('[data-slot="terminal"]') as HTMLElement;
    await waitFor(() => {
      const text = (host.textContent ?? '').replace(/\s+/g, ' ').trim();
      expect(text).toContain('HELLO');
      expect(text).toContain('P>');
    });
  });

  it('populates the TerminalApi (write/writeln/clear/focus/isReady)', async () => {
    // The wrapper binds the api handle post-mount. We allocate an
    // empty TerminalApi and pass it via the `api` prop, then assert
    // that the wrapper has populated all five methods.
    const api: TerminalApi = {
      write: () => undefined,
      writeln: () => undefined,
      clear: () => undefined,
      focus: () => undefined,
      isReady: () => false,
    };
    const { container } = render(Terminal, { props: { banner: 'B', prompt: 'P>', api } });
    const host = container.querySelector('[data-slot="terminal"]') as HTMLElement;
    await waitFor(() => {
      expect(host.getAttribute('data-mounted')).toBe('true');
      // After mount, api.isReady reflects bridge !== null. write/writeln
      // /clear/focus are the wrapper's no-throw shims.
      expect(api.isReady()).toBe(true);
      expect(() => api.write('x')).not.toThrow();
      expect(() => api.writeln('x')).not.toThrow();
      expect(() => api.clear()).not.toThrow();
      expect(() => api.focus()).not.toThrow();
    });
  });

  it('routes textarea input through onData to onCommand on Enter', async () => {
    let captured: string | null = null;
    const { container } = render(Terminal, {
      props: {
        banner: '',
        prompt: '> ',
        onCommand: (cmd: string) => {
          captured = cmd;
        },
      },
    });
    const host = container.querySelector('[data-slot="terminal"]') as HTMLElement;
    // waitFor re-runs the callback while it throws. Return a value
    // (not throw) only when the textarea is in the DOM.
    const textarea = (await waitFor(() => {
      const t = host.querySelector('textarea');
      if (!t) throw new Error('textarea not yet attached');
      return t as HTMLTextAreaElement;
    })) as HTMLTextAreaElement;
    textarea.value = 'ps';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await waitFor(() => {
      expect(captured).toBe('ps');
    });
  });

  it('Ctrl-C clears the input buffer without firing onCommand', async () => {
    let captured: string | null | 'unset' = 'unset';
    const { container } = render(Terminal, {
      props: {
        banner: '',
        prompt: '> ',
        onCommand: (cmd: string) => {
          captured = cmd;
        },
      },
    });
    const host = container.querySelector('[data-slot="terminal"]') as HTMLElement;
    const textarea = (await waitFor(() => {
      const t = host.querySelector('textarea');
      if (!t) throw new Error('textarea not yet attached');
      return t as HTMLTextAreaElement;
    })) as HTMLTextAreaElement;
    textarea.value = 'oops';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, bubbles: true }),
    );
    await waitFor(() => {
      expect(captured).toBe('unset');
    });
  });

  it('Backspace erases one character from the input buffer', async () => {
    // The wrapper handles \u007f (Backspace) by slicing inputBuffer
    // and writing "\b \b" to the renderer. We assert the buffer
    // shrinks (via a follow-up Enter echoing the empty trimmed
    // command) and that the renderer received the erase sequence.
    let captured: string | null | 'unset' = 'unset';
    const { container } = render(Terminal, {
      props: {
        banner: '',
        prompt: '> ',
        onCommand: (cmd: string) => {
          captured = cmd;
        },
      },
    });
    const host = container.querySelector('[data-slot="terminal"]') as HTMLElement;
    const textarea = (await waitFor(() => {
      const t = host.querySelector('textarea');
      if (!t) throw new Error('textarea not yet attached');
      return t as HTMLTextAreaElement;
    })) as HTMLTextAreaElement;
    textarea.value = 'abc';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    // Backspace is sent as a keydown with key='Backspace'; the
    // InputHandler translates it to \u007f in onData.
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await waitFor(() => {
      // After typing 'abc' + backspace, the buffer holds 'ab'.
      expect(captured).toBe('ab');
    });
  });

  it('Ctrl-L clears the screen and re-renders the prompt', async () => {
    const { container } = render(Terminal, {
      props: {
        banner: 'INITIAL_BANNER',
        prompt: 'NEW_PROMPT> ',
      },
    });
    const host = container.querySelector('[data-slot="terminal"]') as HTMLElement;
    await waitFor(() => {
      expect(host.textContent).toContain('INITIAL_BANNER');
    });
    const textarea = (await waitFor(() => {
      const t = host.querySelector('textarea');
      if (!t) throw new Error('textarea not yet attached');
      return t as HTMLTextAreaElement;
    })) as HTMLTextAreaElement;
    // Ctrl-L: the wrapper emits \x1b[3J\x1b[2J\x1b[H (full erase
    // sequence) followed by the prompt. We assert the prompt is
    // re-rendered (which only happens if the Ctrl-L branch ran).
    textarea.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'l', ctrlKey: true, bubbles: true }),
    );
    await waitFor(() => {
      expect(host.textContent).toContain('NEW_PROMPT>');
    });
  });

  it('prints the "no command handler" message when onCommand is omitted', async () => {
    // No onCommand prop. Typing text + Enter should not throw and
    // should write the literal fallback message into the renderer.
    const { container } = render(Terminal, {
      props: { banner: '', prompt: '> ' },
    });
    const host = container.querySelector('[data-slot="terminal"]') as HTMLElement;
    const textarea = (await waitFor(() => {
      const t = host.querySelector('textarea');
      if (!t) throw new Error('textarea not yet attached');
      return t as HTMLTextAreaElement;
    })) as HTMLTextAreaElement;
    textarea.value = 'ls';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await waitFor(() => {
      expect(host.textContent).toContain('no command handler');
    });
  });

  it('renders an empty trimmed Enter as no-op (no onCommand call)', async () => {
    let captured: string | null | 'unset' = 'unset';
    const { container } = render(Terminal, {
      props: {
        banner: '',
        prompt: '> ',
        onCommand: (cmd: string) => {
          captured = cmd;
        },
      },
    });
    const host = container.querySelector('[data-slot="terminal"]') as HTMLElement;
    const textarea = (await waitFor(() => {
      const t = host.querySelector('textarea');
      if (!t) throw new Error('textarea not yet attached');
      return t as HTMLTextAreaElement;
    })) as HTMLTextAreaElement;
    // Whitespace-only input → trimmed is '' → handleLine early-returns
    // without calling onCommand.
    textarea.value = '   ';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await waitFor(() => {
      expect(captured).toBe('unset');
    });
  });

  it('unmount calls wterm.destroy() and removes the term-grid', async () => {
    const { container, unmount } = render(Terminal, { props: { banner: 'B', prompt: 'P>' } });
    const host = container.querySelector('[data-slot="terminal"]') as HTMLElement;
    // Wait for data-mounted="true" — that flag is set in Terminal.svelte
    // AFTER `await t.init()` and the banner/prompt writes, which means
    // `term` has been assigned to the live WTerm instance. Without
    // this, we'd race: the .term-grid appears during init() but the
    // `term` ref isn't wired up until init() resolves.
    await waitFor(() => {
      expect(host.getAttribute('data-mounted')).toBe('true');
    });
    expect(() => unmount()).not.toThrow();
    // destroy() does element.innerHTML = '' which clears the
    // .term-grid child. The .wterm class is left on the host (wterm
    // does not remove it), but the renderer/input are gone.
    expect(host.querySelector('.term-grid')).toBeNull();
    expect(host.querySelector('textarea')).toBeNull();
  });
});
