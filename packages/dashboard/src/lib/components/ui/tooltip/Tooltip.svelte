<!--
  Tooltip — two usage modes:

  1. Controlled (low-level): pass `open` binding + render the tooltip content
     as children. Positioning is up to the parent.

  2. Wrapper (high-level): pass `text` + a single child element as `trigger`.
     The component wraps the trigger in a relative container and handles
     hover/focus state automatically. The tooltip floats above the trigger.

  Example (wrapper mode):
    <Tooltip text="Restart agent">
      {#snippet trigger()}<IconButton aria-label="Restart">…</IconButton>{/snippet}
    </Tooltip>
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';

  type Props = {
    /** Wrapper mode: tooltip label text. */
    text?: string;
    /** Wrapper mode: the element that triggers the tooltip. */
    trigger?: Snippet;
    /** Controlled mode: manually control visibility. */
    open?: boolean;
    /** Extra classes applied to the tooltip bubble. */
    class?: string;
    /** Controlled mode: tooltip bubble content. */
    children?: Snippet;
  };

  let { text, trigger, open = $bindable(false), class: className, children }: Props = $props();

  // Wrapper-mode internal state
  let wrapperVisible = $state(false);
  let uid = $state(`tt-${Math.random().toString(36).slice(2, 8)}`);

  function show() { wrapperVisible = true; }
  function hide() { wrapperVisible = false; }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      if (open) open = false;
      if (wrapperVisible) wrapperVisible = false;
    }
  }

  $effect(() => {
    const active = open || wrapperVisible;
    if (active) document.addEventListener('keydown', onKeydown);
    return () => document.removeEventListener('keydown', onKeydown);
  });
</script>

{#if trigger}
  <!-- Wrapper mode -->
  <div
    class="relative inline-flex"
    onmouseenter={show}
    onmouseleave={hide}
    onfocusin={show}
    onfocusout={hide}
    role="none"
  >
    {@render trigger()}
    {#if wrapperVisible && text}
      <div
        id={uid}
        data-slot="tooltip"
        role="tooltip"
        class={cn(
          'pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs text-background shadow-md',
          'animate-in fade-in-0 zoom-in-95',
          className,
        )}
      >
        {text}
      </div>
    {/if}
  </div>
{:else if open}
  <!-- Controlled mode (legacy) -->
  <div
    data-slot="tooltip"
    role="tooltip"
    class={cn(
      'absolute z-50 max-w-xs rounded-md bg-foreground px-2 py-1 text-xs text-background shadow-md',
      className,
    )}
  >
    {#if children}{@render children()}{/if}
  </div>
{/if}
