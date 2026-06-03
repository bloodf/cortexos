<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';
  let { class: className, children }: { class?: string; children?: Snippet } = $props();
</script>

<td data-slot="table-cell" class={cn('p-2 align-middle whitespace-nowrap', className)}>
  {#if children}{@render children()}{/if}
</td>
