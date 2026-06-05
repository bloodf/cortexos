<!--
  Terminal.svelte — wterm (@wterm/dom) wrapper for the CortexOS terminal page.

  M2-WS2 (Margaret, E2E): the wterm terminal mounts into a host div
  and resizes itself via its built-in autoResize (no FitAddon needed
  in v0.3.0+). We expose the imperative wterm API as a prop (api) so
  a parent (the +page.svelte) can drive output, and we provide an
  onCommand callback so the parent can decide what to do with each
  line.

  Why a wrapper at all? Two reasons:
    1. wterm renders to the DOM (not canvas), so its mount path is
       jsdom-friendly. The wrapper dynamic-imports @wterm/dom inside
       `onMount` and only when running in a real browser so the test
       suite can render the component without crashing, and so SSR
       does not pull the WASM bundle.
    2. The PTY session is owned by the page (the SSE/WS bridge lives
       in the parent). The terminal itself is a dumb renderer.

  M2 → M3: connect to the SSE /api/terminal/stream endpoint. M2: the
  parent can call `terminalApi.write()` to push stub output and pass
  an `onCommand` callback to receive keystrokes.

  Migration W45-W47: this used to be an xterm.js + FitAddon wrapper.
  The wterm v0.3.0 API drops the .open() / .dispose() shape in
  favor of a constructor(host, opts) + init() + destroy() lifecycle,
  and the input is consumed via the `onData` option or the
  `onData` property assignment. The TerminalApi public surface is
  unchanged.
-->
<script lang="ts">
  import { onDestroy, onMount } from 'svelte';

  /** Imperative handle the parent can use to write to / clear the terminal. */
  export interface TerminalApi {
    write: (data: string) => void;
    writeln: (data: string) => void;
    clear: () => void;
    focus: () => void;
    isReady: () => boolean;
  }

  interface Props {
    /** Initial text printed to the terminal on mount. */
    banner?: string;
    /** Prompt rendered in front of the input. */
    prompt?: string;
    /** Called when the user presses Enter. */
    onCommand?: (command: string) => void;
    /** Optional: a writable reference to the underlying terminal handle. */
    api?: TerminalApi;
  }

  let {
    banner = 'CortexOS Terminal — admin only.\r\nAllowlisted ops only. No `bash -c <userstring>`.\r\n',
    prompt = '$ ',
    onCommand,
    api = $bindable(),
  }: Props = $props();

  let host: HTMLDivElement | null = $state(null);
  let mounted = $state(false);

  // We type the wterm object loosely — the public API we touch is
  // small and stable. Storing it as `unknown` here is intentional:
  // we never want a missing @wterm/dom dep to surface as a compile
  // error in this file (it only matters at runtime, gated by jsdom
  // check).
  type TermLike = {
    write: (data: string) => void;
    focus: () => void;
    destroy: () => void;
    element: HTMLElement;
    bridge: { getCell?: (col: number, row: number) => unknown } | null;
  };

  let term: TermLike | null = null;
  let inputBuffer = '';
  // Flag flipped by onDestroy so the async onMount can bail out if the
  // component is torn down before the dynamic import resolves. Without
  // this, vitest's afterEach cleanup unmounts the component while the
  // onMount promise is still in flight, and the WTerm constructor runs
  // against a detached `host` → unhandled rejection.
  let destroyed = false;

  // WTerm constructor options we use. Kept narrow on purpose so the
  // shim above is the only place we touch the wterm surface.
  type WTermOptsLike = {
    cols?: number;
    rows?: number;
    autoResize?: boolean;
    cursorBlink?: boolean;
    onData?: (data: string) => void;
    onResize?: (cols: number, rows: number) => void;
  };
  type WTermCtor = new (host: HTMLElement, opts?: WTermOptsLike) => {
    init(): Promise<unknown>;
    destroy(): void;
  } & TermLike;

  function safeWrite(data: string): void {
    try {
      term?.write(data);
    } catch {
      // ignore — terminal might have been disposed mid-render
    }
  }

  function renderPrompt(): void {
    safeWrite(`\r\n${prompt}`);
    inputBuffer = '';
  }

  function handleLine(line: string): void {
    safeWrite('\r\n');
    const trimmed = line.trim();
    if (!trimmed) {
      renderPrompt();
      return;
    }
    if (onCommand) {
      onCommand(trimmed);
    } else {
      safeWrite('(no command handler — pass `onCommand` to Terminal.svelte)\r\n');
    }
    // Parent decides whether to re-prompt. We don't auto-prompt here.
  }

  onMount(async () => {
    // jsdom guard: only mount wterm when we have a real DOM. Tests
    // skip this branch entirely (see terminal-mount.test.ts).
    if (typeof window === 'undefined' || !host) return;

    const { WTerm } = (await import('@wterm/dom')) as { WTerm: WTermCtor };
    // wterm's CSS — required for the terminal to look right.
    await import('@wterm/dom/css');

    // The two awaits above can race with onDestroy. If the component
    // is torn down while the dynamic import is in flight, `host` is
    // null by the time we reach here. Bail out cleanly instead of
    // letting the WTerm constructor throw an unhandled rejection.
    if (destroyed || !host) return;

    const t = new WTerm(host, {
      autoResize: true, // replaces FitAddon
      cursorBlink: true,
      onData: (data: string) => {
        // ANSI / control handling:
        //   \r        → Enter
        //   \u007f    → Backspace
        //   \u0003    → Ctrl-C (clear input)
        //   \u000c    → Ctrl-L (clear screen, redraw prompt)
        if (data === '\r') {
          handleLine(inputBuffer);
          return;
        }
        if (data === '\u007f') {
          if (inputBuffer.length > 0) {
            inputBuffer = inputBuffer.slice(0, -1);
            safeWrite('\b \b');
          }
          return;
        }
        if (data === '\u0003') {
          safeWrite('^C');
          inputBuffer = '';
          return;
        }
        if (data === '\u000c') {
          // wterm has no .clear() — emit the full erase sequence.
          // \x1b[3J = erase scrollback, \x1b[2J = erase visible
          // screen, \x1b[H = home cursor. Confirmed supported by
          // wterm's Zig core (eraseInDisplay modes 0/1/2/3).
          safeWrite('\x1b[3J\x1b[2J\x1b[H');
          safeWrite(prompt);
          inputBuffer = '';
          return;
        }
        // wterm already strips most controls; this is a safe echo.
        inputBuffer += data;
        safeWrite(data);
      },
    });
    await t.init();
    t.write(banner);
    t.write(prompt);

    term = t;
    mounted = true;

    if (api) {
      api.write = (d: string) => safeWrite(d);
      api.writeln = (d: string) => safeWrite(`${d}\r\n`);
      api.clear = () => safeWrite('\x1b[3J\x1b[2J\x1b[H');
      api.focus = () => {
        try {
          t.focus();
        } catch {
          // focus can throw if the host is detached
        }
      };
      api.isReady = () => mounted && t.bridge !== null;
    }
  });

  onDestroy(() => {
    destroyed = true;
    try {
      term?.destroy();
    } catch {
      // ignore
    }
    term = null;
    mounted = false;
  });
</script>

<div
  bind:this={host}
  data-slot="terminal"
  data-mounted={mounted ? 'true' : 'false'}
  class="h-[60vh] min-h-[320px] w-full overflow-hidden rounded-md border border-border bg-[#0b0f17] p-2"
  role="application"
  aria-label="Terminal"
></div>
