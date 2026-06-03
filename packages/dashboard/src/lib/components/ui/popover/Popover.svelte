<!--
  Popover — non-modal floating panel. Pair with a trigger.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';
  type Props = {
    open?: boolean;
    class?: string;
    children?: Snippet;
  };
  let { open = $bindable(false), class: className, children }: Props = $props();
  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && open) {
      open = false;
    }
  }
  $effect(() => {
    if (open) document.addEventListener('keydown', onKeydown);
    return () => document.removeEventListener('keydown', onKeydown);
  });
</script>

{#if open}
  <div
    data-slot="popover"
    role="dialog"
    aria-label="Popover"
    class={cn(
      'absolute z-50 mt-1 min-w-32 rounded-md border border-border bg-popover p-3 text-popover-foreground shadow-md ring-1 ring-foreground/10',
      className,
    )}
  >
    {#if children}{@render children()}{/if}
  </div>
{/if}
