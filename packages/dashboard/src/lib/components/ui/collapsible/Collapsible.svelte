<!--
  Collapsible — single open/close section. Use it when you don't need
  multi-item accordion behaviour. For multiple linked sections, prefer
  `Accordion`.

  Usage:
    <Collapsible>
      <CollapsibleTrigger>Show details</CollapsibleTrigger>
      <CollapsibleContent>Hidden body.</CollapsibleContent>
    </Collapsible>
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';

  type Props = {
    open?: boolean;
    onopenChange?: (open: boolean) => void;
    class?: string;
    children?: Snippet;
  };
  let {
    open = $bindable(false),
    onopenChange,
    class: className,
    children,
  }: Props = $props();

  function setOpen(next: boolean) {
    open = next;
    onopenChange?.(next);
  }

  // Provide a context-like export so trigger/content can read it.
  export function getState() {
    return { open, setOpen };
  }
</script>

<div data-slot="collapsible" data-state={open ? 'open' : 'closed'} class={cn(className)}>
  {#if children}{@render children()}{/if}
</div>
