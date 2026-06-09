<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';
  let {
    class: className,
    children,
    colspan,
    rowspan,
  }: { class?: string; children?: Snippet; colspan?: number; rowspan?: number } = $props();
</script>

<td data-slot="table-cell" class={cn('p-2 align-middle whitespace-nowrap', className)} {colspan} {rowspan}>
  {#if children}{@render children()}{/if}
</td>
