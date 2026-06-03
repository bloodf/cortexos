<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';
  let { class: className, children }: { class?: string; children?: Snippet } = $props();
</script>

<div data-slot="card-footer" class={cn('flex items-center px-4 pt-2', className)}>
  {#if children}{@render children()}{/if}
</div>
