<!--
  Badge — small label for status, counts, or categories.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { tv } from '$lib/utils/tv';
  import { cn } from '$lib/utils/cn';

  type Variant = 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info';
  type Size = 'default' | 'sm';

  type Props = {
    variant?: Variant;
    size?: Size;
    class?: string;
    children?: Snippet;
  };
  let { variant = 'default', size = 'default', class: className, children }: Props = $props();

  const badge = tv({
    base: 'inline-flex shrink-0 items-center gap-1 rounded-full border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-colors focus-visible:ring-3 focus-visible:ring-ring/50',
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground',
        secondary: 'bg-secondary text-secondary-foreground',
        destructive: 'bg-destructive text-destructive-foreground',
        outline: 'border-border text-foreground',
        success: 'bg-success/10 text-success',
        warning: 'bg-warning/10 text-warning',
        info: 'bg-info/10 text-info',
      },
      size: {
        default: 'h-5',
        sm: 'h-4 text-[10px]',
      },
    },
    defaults: { variant: 'default', size: 'default' },
  });
  const classes = $derived(badge({ variant, size, class: className as string | undefined }));
</script>

<span data-slot="badge" class={cn(classes)}>
  {#if children}{@render children()}{/if}
</span>
