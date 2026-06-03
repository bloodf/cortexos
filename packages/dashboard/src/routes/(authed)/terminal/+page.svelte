<script lang="ts">
  import type { PageData } from './$types';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import TerminalSquare from '$lib/icons/TerminalSquare.svelte';
  import { t } from '$lib/i18n';
  import Terminal, { type TerminalApi } from '$lib/components/terminal/Terminal.svelte';
  import CommandPalette, {
    type TerminalOp,
  } from '$lib/components/terminal/CommandPalette.svelte';

  interface Props {
    data: PageData;
  }

  let { data }: Props = $props();

  const title = $derived(t(data.messages, 'app.nav.terminal'));

  let api: TerminalApi | undefined = $state();
  let lastOp = $state<string | null>(null);
  let lastStatus = $state<'idle' | 'pending' | 'ok' | 'error'>('idle');
  let lastError = $state<string | null>(null);

  function feedBanner(text: string): void {
    if (!api) return;
    api.writeln(text);
  }

  async function dispatch(op: TerminalOp, args: Record<string, unknown> = {}): Promise<void> {
    lastOp = op.op;
    lastStatus = 'pending';
    lastError = null;
    feedBanner(`\r\n→ ${op.op} ${JSON.stringify(args)}`);
    try {
      const res = await fetch('/api/terminal', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ op: op.op, args }),
      });
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (res.ok) {
        const argv = Array.isArray(body.argv) ? (body.argv as string[]).join(' ') : '';
        lastStatus = 'ok';
        feedBanner(`\r\n← ${res.status} accepted — argv: ${argv}`);
        feedBanner(`\r\n$ `);
      } else {
        lastStatus = 'error';
        const msg =
          (typeof body.message === 'string' && body.message) ||
          (Array.isArray(body.details) &&
            (body.details[0] as { message?: string })?.message) ||
          'Unknown error';
        lastError = msg;
        feedBanner(`\r\n← ${res.status} ${msg}`);
        feedBanner(`\r\n$ `);
      }
    } catch (e) {
      lastStatus = 'error';
      lastError = (e as Error).message;
      feedBanner(`\r\n← network error: ${(e as Error).message}`);
      feedBanner(`\r\n$ `);
    }
  }

  function onTerminalCommand(command: string): void {
    // Parse `op arg1=value1 arg2=value2` from the terminal panel.
    const parts = command.split(/\s+/);
    const head = parts.shift();
    if (!head) {
      feedBanner('\r\n(empty)');
      feedBanner('\r\n$ ');
      return;
    }
    const op = data.ops.find((o) => o.op === head);
    if (!op) {
      feedBanner(`\r\nunknown op: ${head}. Try one from the Quick commands palette.`);
      feedBanner('\r\n$ ');
      return;
    }
    const args: Record<string, unknown> = {};
    for (const p of parts) {
      const eq = p.indexOf('=');
      if (eq < 0) continue;
      const k = p.slice(0, eq);
      const v = p.slice(eq + 1);
      args[k] = v;
    }
    void dispatch(op, args);
  }

  function onPaletteSelect(op: TerminalOp): void {
    // For ops without placeholders, fire immediately.
    // For ops with placeholders, we still fire — the server will reject
    // the missing arg. The UX hint is the placeholder label.
    void dispatch(op);
  }
</script>

<svelte:head>
  <title>{title} · CortexOS</title>
</svelte:head>

<div class="flex flex-col gap-6">
  <PageHeader
    {title}
    description="Web-TTY to the host — admin only. Allowlisted ops only. No `bash -c <userstring>`."
    icon={TerminalSquare}
  />

  <div class="flex items-center justify-between gap-3">
    <CommandPalette ops={data.ops} onSelect={onPaletteSelect} />
    <div
      class="text-xs text-muted-foreground"
      data-slot="terminal-status"
      data-status={lastStatus}
    >
      {#if lastStatus === 'idle'}
        Idle.
      {:else if lastStatus === 'pending'}
        {lastOp}… pending
      {:else if lastStatus === 'ok'}
        {lastOp} accepted.
      {:else}
        {lastOp} error: {lastError}
      {/if}
    </div>
  </div>

  <Terminal bind:api onCommand={onTerminalCommand} />
</div>
