<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';
  type Props = {
    class?: string;
    children?: Snippet;
  };
  let { class: className, children }: Props = $props();
</script>

<div data-slot="sheet-body" class={cn('flex-1 p-4 text-sm text-foreground', className)}>
  {#if children}{@render children()}{/if}
</div>
