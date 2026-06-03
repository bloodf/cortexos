<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';
  let { class: className, children }: { class?: string; children?: Snippet } = $props();
</script>

<caption data-slot="table-caption" class={cn('mt-4 text-sm text-muted-foreground', className)}>
  {#if children}{@render children()}{/if}
</caption>
