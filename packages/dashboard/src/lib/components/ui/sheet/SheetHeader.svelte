<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';
  type Props = {
    class?: string;
    children?: Snippet;
  };
  let { class: className, children }: Props = $props();
</script>

<div data-slot="sheet-header" class={cn('flex flex-col gap-1.5 p-4 border-b border-border', className)}>
  {#if children}{@render children()}{/if}
</div>
