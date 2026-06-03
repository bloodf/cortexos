<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';
  import { slide } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';

  type Props = {
    open: boolean;
    class?: string;
    children?: Snippet;
  };
  let { open, class: className, children }: Props = $props();
</script>

{#if open}
  <div
    data-slot="collapsible-content"
    data-state="open"
    transition:slide={{ duration: 180, easing: cubicOut }}
    class={cn('text-sm text-muted-foreground', className)}
  >
    {#if children}{@render children()}{/if}
  </div>
{/if}
