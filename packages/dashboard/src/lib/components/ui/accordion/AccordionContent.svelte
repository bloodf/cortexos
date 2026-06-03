<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';
  type Props = {
    value: string;
    open?: string;
    class?: string;
    children?: Snippet;
  };
  let { value, open, class: className, children }: Props = $props();
  const isOpen = $derived(open === value);
</script>

{#if isOpen}
  <div
    role="region"
    data-state="open"
    data-value={value}
    class={cn('px-4 pb-3 pt-0 text-sm text-muted-foreground', className)}
  >
    {#if children}{@render children()}{/if}
  </div>
{/if}
