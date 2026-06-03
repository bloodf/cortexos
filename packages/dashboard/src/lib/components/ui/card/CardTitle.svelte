<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';
  let { class: className, children }: { class?: string; children?: Snippet } = $props();
</script>

<div data-slot="card-title" class={cn('text-base leading-none font-semibold', className)}>
  {#if children}{@render children()}{/if}
</div>
