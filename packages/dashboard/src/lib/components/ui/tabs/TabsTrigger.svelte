<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';
  type Props = {
    value: string;
    selected?: string;
    onselect?: (value: string) => void;
    class?: string;
    children?: Snippet;
  };
  let { value, selected = $bindable(''), onselect, class: className, children }: Props = $props();
  const isActive = $derived(selected === value);
</script>

<button
  type="button"
  role="tab"
  aria-selected={isActive}
  tabindex={isActive ? 0 : -1}
  data-state={isActive ? 'active' : 'inactive'}
  data-value={value}
  class={cn(
    'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1 text-sm font-medium transition-all',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
    'disabled:pointer-events-none disabled:opacity-50',
    isActive
      ? 'bg-background text-foreground shadow-sm'
      : 'text-muted-foreground hover:text-foreground',
    className,
  )}
  onclick={() => {
    selected = value;
    onselect?.(value);
  }}
>
  {#if children}{@render children()}{/if}
</button>
