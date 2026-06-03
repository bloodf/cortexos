<!--
  Alert — info / success / warning / error banners with role="alert".
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { tv } from '$lib/utils/tv';
  import { cn } from '$lib/utils/cn';
  type Variant = 'info' | 'success' | 'warning' | 'error';
  type Props = {
    variant?: Variant;
    title?: string;
    class?: string;
    children?: Snippet;
  };
  let { variant = 'info', title, class: className, children }: Props = $props();

  const alert = tv({
    base: 'flex items-start gap-3 rounded-md border p-3 text-sm',
    variants: {
      variant: {
        info: 'border-info/30 bg-info/10 text-info-foreground',
        success: 'border-success/30 bg-success/10 text-success-foreground',
        warning: 'border-warning/30 bg-warning/10 text-warning-foreground',
        error: 'border-destructive/30 bg-destructive/10 text-destructive-foreground',
      },
    },
    defaults: { variant: 'info' },
  });
  const classes = $derived(alert({ variant, class: className as string | undefined }));
</script>

<div data-slot="alert" role="alert" data-variant={variant} class={cn(classes)}>
  <div class="flex-1 min-w-0">
    {#if title}
      <p data-slot="alert-title" class="font-medium">{title}</p>
    {/if}
    <div data-slot="alert-description" class={cn('text-sm', title ? 'mt-1' : '')}>
      {#if children}{@render children()}{/if}
    </div>
  </div>
</div>
