<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';
  let { class: className, children }: { class?: string; children?: Snippet } = $props();
</script>

<thead data-slot="table-header" class={cn('[&_tr]:border-b', className)}>
  {#if children}{@render children()}{/if}
</thead>
