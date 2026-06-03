<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';
  let { class: className, children }: { class?: string; children?: Snippet } = $props();
</script>

<div data-slot="card-header" class={cn('flex flex-col gap-1.5 px-4', className)}>
  {#if children}{@render children()}{/if}
</div>
