<!--
  Table — semantic <table> with subcomponents: TableHeader, TableBody, TableRow,
  TableHead, TableCell, TableFooter. Compose freely; styling is applied via
  data-slot hooks.
-->
<script lang="ts" module>
  import type { Snippet } from 'svelte';
</script>

<script lang="ts">
  import { cn } from '$lib/utils/cn';
  let { class: className, children }: { class?: string; children?: Snippet } = $props();
</script>

<div data-slot="table-container" class="relative w-full overflow-x-auto">
  <table data-slot="table" class={cn('w-full caption-bottom text-sm', className)}>
    {#if children}{@render children()}{/if}
  </table>
</div>
