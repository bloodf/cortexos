<!--
  Tooltip — appears on focus/hover, dismisses on Escape and blur.
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
