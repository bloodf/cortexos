<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';
  let { class: className, children }: { class?: string; children?: Snippet } = $props();
</script>

<tbody data-slot="table-body" class={cn('[&_tr:last-child]:border-0', className)}>
  {#if children}{@render children()}{/if}
</tbody>
