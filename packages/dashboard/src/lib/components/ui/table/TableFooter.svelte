<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';
  let { class: className, children }: { class?: string; children?: Snippet } = $props();
</script>

<tfoot data-slot="table-footer" class={cn('border-t bg-muted/50 font-medium [&>tr]:last:border-b-0', className)}>
  {#if children}{@render children()}{/if}
</tfoot>
