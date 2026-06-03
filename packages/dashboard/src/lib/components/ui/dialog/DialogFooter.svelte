<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';
  let { class: className, children }: { class?: string; children?: Snippet } = $props();
</script>

<div data-slot="dialog-footer" class={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}>
  {#if children}{@render children()}{/if}
</div>
