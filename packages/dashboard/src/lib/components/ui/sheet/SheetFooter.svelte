<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';
  type Props = {
    class?: string;
    children?: Snippet;
  };
  let { class: className, children }: Props = $props();
</script>

<div
  data-slot="sheet-footer"
  class={cn('flex items-center justify-end gap-2 p-4 border-t border-border', className)}
>
  {#if children}{@render children()}{/if}
</div>
