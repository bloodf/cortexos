<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';
  let { class: className, children }: { class?: string; children?: Snippet } = $props();
</script>

<tr data-slot="table-row" class={cn('border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted', className)}>
  {#if children}{@render children()}{/if}
</tr>
