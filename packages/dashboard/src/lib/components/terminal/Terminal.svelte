<!--
  Terminal.svelte — xterm.js wrapper for the CortexOS terminal page.

  M2-WS2 (Margaret, E2E): the xterm.js terminal mounts into a host
  div and gets a fit-addon so it resizes to the container. We expose
  the imperative xterm API as a prop (api) so a parent (the
  +page.svelte) can drive output, and we provide an onCommand
  callback so the parent can decide what to do with each line.

  Why a wrapper at all? Two reasons:
    1. jsdom does not implement the layout APIs xterm.js relies on
       (canvas font metrics, getBoundingClientRect measurements at
       mount time). The wrapper lazy-imports xterm.js inside an
       `onMount` and only when running in a real browser, so the test
       suite can render the component without crashing.
    2. The PTY session is owned by the page (the SSE/WS bridge lives
       in the parent). The terminal itself is a dumb renderer.

  M3: connect to the SSE /api/terminal/stream endpoint. M2: the
  parent can call `terminalApi.write()` to push stub output and pass
  an `onCommand` callback to receive keystrokes.
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

  // We type the xterm.js objects loosely — the public API we touch is
  // small and stable. Storing them as `unknown` here is intentional:
  // we never want a missing xterm.js dep to surface as a compile error
  // in this file (it only matters at runtime, gated by jsdom check).
  type TermLike = {
    write: (data: string) => void;
    writeln: (data: string) => void;
    clear: () => void;
    focus: () => void;
    dispose: () => void;
    open: (parent: HTMLElement) => void;
    onData: (cb: (data: string) => void) => { dispose: () => void };
  };
  type FitAddonLike = { fit: () => void; dispose: () => void };

  let term: TermLike | null = null;
  let fitAddon: FitAddonLike | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let inputBuffer = '';

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
    // jsdom guard: only mount xterm.js when we have a real DOM. Tests
    // skip this branch entirely.
    if (typeof window === 'undefined' || !host) return;

    const [{ Terminal }, { FitAddon }] = await Promise.all([
      import('@xterm/xterm'),
      import('@xterm/addon-fit'),
    ]);
    // xterm's CSS — required for the terminal to look right.
    await import('@xterm/xterm/css/xterm.css');

    const t = new Terminal({
      convertEol: true,
      cursorBlink: true,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      fontSize: 13,
      theme: {
        background: '#0b0f17',
        foreground: '#e6e6e6',
        cursor: '#e6e6e6',
      },
      scrollback: 5000,
    }) as unknown as TermLike;
    const fit = new FitAddon() as unknown as FitAddonLike;

    t.open(host);
    try {
      fit.fit();
    } catch {
      // fit can throw pre-layout; the ResizeObserver fixes it later.
    }
    t.write(banner);
    t.write(prompt);

    t.onData((data: string) => {
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
        t.clear();
        t.write(prompt);
        inputBuffer = '';
        return;
      }
      // xterm already strips most controls; this is a safe echo.
      inputBuffer += data;
      safeWrite(data);
    });

    term = t;
    fitAddon = fit;
    mounted = true;

    if (api) {
      api.write = (d: string) => safeWrite(d);
      api.writeln = (d: string) => safeWrite(`${d}\r\n`);
      api.clear = () => t.clear();
      api.focus = () => t.focus();
      api.isReady = () => mounted;
    }

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        try {
          fitAddon?.fit();
        } catch {
          // ignore
        }
      });
      resizeObserver.observe(host);
    }
  });

  onDestroy(() => {
    resizeObserver?.disconnect();
    resizeObserver = null;
    try {
      term?.dispose();
    } catch {
      // ignore
    }
    term = null;
    fitAddon = null;
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
