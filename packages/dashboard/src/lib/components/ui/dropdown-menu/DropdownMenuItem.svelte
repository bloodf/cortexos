<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';
  type Variant = 'default' | 'destructive';
  let {
    variant = 'default',
    disabled,
    onclick,
    class: className,
    children,
  }: {
    variant?: Variant;
    disabled?: boolean;
    onclick?: (e: MouseEvent) => void;
    class?: string;
    children?: Snippet;
  } = $props();
</script>

<button
  type="button"
  role="menuitem"
  tabindex="-1"
  {disabled}
  data-variant={variant}
  class={cn(
    'flex w-full cursor-default items-center gap-1.5 rounded-sm px-2 py-1 text-sm outline-none select-none',
    'focus:bg-accent focus:text-accent-foreground',
    'disabled:pointer-events-none disabled:opacity-50',
    variant === 'destructive' ? 'text-destructive focus:bg-destructive/10 focus:text-destructive' : '',
    className,
  )}
  {onclick}
>
  {#if children}{@render children()}{/if}
</button>
