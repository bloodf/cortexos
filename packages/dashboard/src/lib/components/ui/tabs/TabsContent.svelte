<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';
  type Props = {
    value: string;
    selected?: string;
    class?: string;
    children?: Snippet;
  };
  let { value, selected, class: className, children }: Props = $props();
  const isActive = $derived(selected === value);
</script>

{#if isActive}
  <div
    role="tabpanel"
    data-state="active"
    data-value={value}
    class={cn('mt-2 focus-visible:outline-none', className)}
    tabindex="0"
  >
    {#if children}{@render children()}{/if}
  </div>
{/if}
