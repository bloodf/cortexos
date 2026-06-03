<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';
  let { class: className, children }: { class?: string; children?: Snippet } = $props();
</script>

<div data-slot="dialog-header" class={cn('flex flex-col gap-1.5', className)}>
  {#if children}{@render children()}{/if}
</div>
