<!--
  CommandPalette — Cmd+K (or Ctrl+K) command launcher with fuzzy search.

  Usage:
    <CommandPalette
      open={isOpen}
      onclose={() => isOpen = false}
      commands={[
        { id: 'save', label: 'Save', shortcut: '⌘S', onselect: () => save() },
        { id: 'open', label: 'Open file', onselect: () => open() },
      ]}
    />
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';
  import { tv } from '$lib/utils/tv';

  export type Command = {
    id: string;
    label: string;
    description?: string;
    shortcut?: string;
    group?: string;
    onselect: () => void;
  };

  type Props = {
    open?: boolean;
    onclose?: () => void;
    commands?: Command[];
    placeholder?: string;
    class?: string;
    empty?: Snippet;
  };
  let {
    open = $bindable(false),
    onclose,
    commands = [],
    placeholder = 'Type a command or search...',
    class: className,
    empty,
  }: Props = $props();

  let query = $state('');
  let activeIndex = $state(0);

  const filtered = $derived.by(() => {
    const q = query.toLowerCase();
    if (!q) return commands;
    return commands.filter(
      (c) => c.label.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q),
    );
  });

  $effect(() => {
    // Reset selection whenever the filter list changes.
    void filtered;
    if (activeIndex >= filtered.length) activeIndex = 0;
  });

  function close() {
    open = false;
    onclose?.();
  }

  function onKeydown(e: KeyboardEvent) {
    if (!open) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, Math.max(0, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex =
        activeIndex === 0 ? Math.max(0, filtered.length - 1) : activeIndex - 1;
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const cmd = filtered[activeIndex];
      if (cmd) {
        cmd.onselect();
        close();
      }
    }
  }

  // Global Cmd/Ctrl+K binding.
  $effect(() => {
    function onGlobalKeydown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        open = !open;
        if (open) {
          query = '';
          activeIndex = 0;
        }
      }
    }
    document.addEventListener('keydown', onGlobalKeydown);
    return () => document.removeEventListener('keydown', onGlobalKeydown);
  });

  const container = tv({
    base: 'flex flex-col gap-2 rounded-xl bg-popover p-2 text-popover-foreground shadow-lg ring-1 ring-foreground/10',
  });
  const item = tv({
    base: 'flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer select-none',
    variants: {
      active: {
        true: 'bg-muted text-foreground',
        false: 'hover:bg-muted/50',
      },
    },
    defaults: { active: 'false' as const },
  });
</script>

<svelte:window onkeydown={onKeydown} />

{#if open}
  <div data-slot="command-palette" role="dialog" aria-modal="true" aria-label="Command palette">
    <div
      data-slot="command-palette-overlay"
      class="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
      onclick={close}
      role="presentation"
    ></div>
    <div
      data-slot="command-palette-panel"
      class={cn(
        'fixed top-1/4 left-1/2 z-50 w-full max-w-lg -translate-x-1/2',
        container(),
        className,
      )}
    >
      <!-- svelte-ignore a11y_autofocus -- intentional for a Cmd-K palette UX -->
      <input
        data-slot="command-palette-input"
        type="text"
        bind:value={query}
        {placeholder}
        class="w-full rounded-md bg-transparent px-2 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
        autofocus
      />
      <div data-slot="command-palette-list" class="max-h-72 overflow-y-auto">
        {#if filtered.length === 0}
          <div data-slot="command-palette-empty" class="px-2 py-6 text-center text-sm text-muted-foreground">
            {#if empty}{@render empty()}{:else}No commands match.{/if}
          </div>
        {:else}
          {#each filtered as cmd, i (cmd.id)}
            <button
              type="button"
              data-slot="command-palette-item"
              data-state={i === activeIndex ? 'active' : 'inactive'}
              class={cn(item({ active: i === activeIndex ? 'true' : 'false' }))}
              onmouseenter={() => (activeIndex = i)}
              onclick={() => {
                cmd.onselect();
                close();
              }}
            >
              <span class="flex flex-col items-start">
                <span class="font-medium">{cmd.label}</span>
                {#if cmd.description}
                  <span class="text-xs text-muted-foreground">{cmd.description}</span>
                {/if}
              </span>
              {#if cmd.shortcut}
                <kbd class="rounded border border-border bg-background px-1.5 py-0.5 text-xs text-muted-foreground">
                  {cmd.shortcut}
                </kbd>
              {/if}
            </button>
          {/each}
        {/if}
      </div>
    </div>
  </div>
{/if}
