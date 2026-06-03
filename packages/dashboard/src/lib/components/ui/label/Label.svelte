<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';
  type Props = {
    for?: string;
    class?: string;
    children?: Snippet;
  };
  let { for: htmlFor, class: className, children }: Props = $props();
</script>

<label
  for={htmlFor}
  data-slot="label"
  class={cn(
    'inline-flex items-center text-sm font-medium select-none',
    'peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
    className,
  )}
>
  {#if children}{@render children()}{/if}
</label>
