<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';
  let { class: className, children }: { class?: string; children?: Snippet } = $props();
</script>

<p data-slot="dialog-description" class={cn('text-sm text-muted-foreground', className)}>
  {#if children}{@render children()}{/if}
</p>
