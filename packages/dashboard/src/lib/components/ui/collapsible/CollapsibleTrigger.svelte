<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';

  type Props = {
    open: boolean;
    onopenChange: (next: boolean) => void;
    class?: string;
    children?: Snippet;
  };
  let { open, onopenChange, class: className, children }: Props = $props();
</script>

<button
  type="button"
  data-slot="collapsible-trigger"
  data-state={open ? 'open' : 'closed'}
  aria-expanded={open}
  class={cn(
    'inline-flex items-center gap-2 text-sm font-medium transition-colors hover:text-foreground',
    className,
  )}
  onclick={() => onopenChange(!open)}
>
  {#if children}{@render children()}{/if}
  <span aria-hidden="true" class="transition-transform" style:transform={open ? 'rotate(90deg)' : 'none'}>›</span>
</button>
