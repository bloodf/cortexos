<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';
  type Props = {
    value: string;
    open?: string;
    onopen?: (value: string) => void;
    class?: string;
    children?: Snippet;
  };
  let { value, open = $bindable(''), onopen, class: className, children }: Props = $props();
  const isOpen = $derived(open === value);
</script>

<button
  type="button"
  aria-expanded={isOpen}
  data-state={isOpen ? 'open' : 'closed'}
  data-value={value}
  class={cn(
    'flex w-full items-center justify-between gap-2 px-4 py-3 text-sm font-medium transition-colors',
    'hover:bg-muted/50',
    className,
  )}
  onclick={() => {
    open = isOpen ? '' : value;
    if (!isOpen) onopen?.(value);
  }}
>
  {#if children}{@render children()}{/if}
  <span aria-hidden="true">{isOpen ? '−' : '+'}</span>
</button>
