<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';
  type Props = {
    class?: string;
    children?: Snippet;
  };
  let { class: className, children }: Props = $props();
</script>

<h2 data-slot="sheet-title" class={cn('text-base font-semibold text-foreground', className)}>
  {#if children}{@render children()}{/if}
</h2>
