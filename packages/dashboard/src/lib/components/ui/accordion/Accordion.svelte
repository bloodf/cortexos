<!--
  Accordion — single-open by default. Each item is a button that toggles its
  panel. WAI-ARIA pattern: role="region" + aria-expanded.
-->
<script lang="ts" module>
  // Module-level reserved for future top-level exports.
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';
  type Props = {
    value?: string;
    onchange?: (value: string) => void;
    class?: string;
    children?: Snippet;
  };
  let { value = $bindable(''), onchange, class: className, children }: Props = $props();
</script>

<div data-slot="accordion" class={cn('flex flex-col divide-y divide-border rounded-md border border-border', className)}>
  {#if children}{@render children()}{/if}
</div>
