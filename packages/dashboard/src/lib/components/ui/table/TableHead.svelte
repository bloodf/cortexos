<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';
  let { class: className, children }: { class?: string; children?: Snippet } = $props();
</script>

<th data-slot="table-head" class={cn('h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground', className)}>
  {#if children}{@render children()}{/if}
</th>
