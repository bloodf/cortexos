<!--
  CommandPalette.svelte — quick command picker for the Terminal page.

  Wraps the design-system `CommandPalette` from
  `$lib/components/ui/command-palette`. The design-system one is the
  reusable primitive (a Cmd-K launcher); here we use it as a fixed,
  inline picker that shows the allowlisted terminal ops a user can
  fire without typing.

  Why a separate wrapper?
    - We want a stable "Quick actions" affordance on the Terminal
      page that does NOT steal focus from the xterm panel.
    - The design-system `CommandPalette` toggles on `open`. We drive
      that with a local button (so the user can `Cmd+K` from the
      terminal panel and have a picker appear, with arrow-key
      navigation, that fires an op when picked).
    - The "ops" list comes from `+page.server.ts` (which calls the
      PTY bridge's `listTerminalOps()`), and the picked op is sent to
      the parent via `onSelect`.
-->
<script lang="ts">
  import {
    CommandPalette as DsCommandPalette,
    type Command,
  } from '$lib/components/ui/command-palette';
  import Button from '$lib/components/ui/Button.svelte';
  import Search from '$lib/icons/Search.svelte';

  export interface TerminalOp {
    op: string;
    description: string;
    requiresApproval: boolean;
    placeholders: ReadonlyArray<string>;
  }

  interface Props {
    ops: ReadonlyArray<TerminalOp>;
    onSelect: (op: TerminalOp) => void;
  }

  let { ops, onSelect }: Props = $props();

  let open = $state(false);

  const commands: Command[] = $derived(
    ops.map((op) => ({
      id: op.op,
      label: op.op,
      description:
        op.description +
        (op.requiresApproval ? ' (requires approval)' : '') +
        (op.placeholders.length > 0 ? ` — args: ${op.placeholders.join(', ')}` : ''),
      group: op.requiresApproval ? 'Approval required' : 'Read-only',
      onselect: () => onSelect(op),
    })),
  );

  function openPalette(): void {
    open = true;
  }
</script>

<div class="flex items-center gap-2">
  <Button variant="outline" size="sm" onclick={openPalette} ariaLabel="Open quick command palette">
    <Search class="h-4 w-4" />
    <span>Quick commands</span>
    <kbd class="ml-2 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">⌘K</kbd>
  </Button>
</div>

<DsCommandPalette
  bind:open
  {commands}
  placeholder="Search allowlisted terminal ops…"
>
  {#snippet empty()}
    <span>No matching ops.</span>
  {/snippet}
</DsCommandPalette>
