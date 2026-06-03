<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';
  let { class: className, children }: { class?: string; children?: Snippet } = $props();
</script>

<div data-slot="card-body" class={cn('px-4', className)}>
  {#if children}{@render children()}{/if}
</div>
