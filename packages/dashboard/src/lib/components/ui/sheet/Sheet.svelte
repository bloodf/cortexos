<!--
  Sheet — side-anchored modal panel (drawer pattern).

  Renders a Dialog-like overlay with a content panel anchored to one edge of
  the viewport. Use `side="right"|"left"|"top"|"bottom"` to choose the edge.

  Usage:
    <Sheet open={isOpen} side="right" onclose={() => isOpen = false}>
      <SheetHeader>
        <SheetTitle>Edit profile</SheetTitle>
      </SheetHeader>
      <SheetBody>...</SheetBody>
    </Sheet>
-->
<script lang="ts" module>
  /**
   * Focus trap helper. Re-exported from `Dialog.svelte` if you need a custom
   * trap; otherwise Sheet relies on the same Escape + click-outside behaviour.
   */
  export { trapFocus as focusTrap } from '../dialog/Dialog.svelte';
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';
  import { tv } from '$lib/utils/tv';
  import { fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';

  type Side = 'right' | 'left' | 'top' | 'bottom';
  type SheetProps = {
    open?: boolean;
    side?: Side;
    onclose?: () => void;
    children?: Snippet;
    class?: string;
  };
  let {
    open = $bindable(false),
    side = 'right',
    onclose,
    children,
    class: className,
  }: SheetProps = $props();

  let contentEl: HTMLDivElement | undefined = $state();

  function close() {
    open = false;
    onclose?.();
  }

  function onKeydownGlobal(e: KeyboardEvent) {
    if (e.key === 'Escape' && open) {
      e.preventDefault();
      close();
    }
  }

  $effect(() => {
    if (open) {
      document.addEventListener('keydown', onKeydownGlobal);
      document.body.style.overflow = 'hidden';
    } else {
      document.removeEventListener('keydown', onKeydownGlobal);
      document.body.style.overflow = '';
    }
    return () => {
      document.removeEventListener('keydown', onKeydownGlobal);
      document.body.style.overflow = '';
    };
  });

  const panel = tv({
    base: 'fixed z-50 bg-popover text-popover-foreground shadow-lg ring-1 ring-foreground/10 outline-none overflow-y-auto',
    variants: {
      side: {
        right: 'top-0 right-0 h-full w-3/4 max-w-sm border-l border-border',
        left: 'top-0 left-0 h-full w-3/4 max-w-sm border-r border-border',
        top: 'top-0 left-0 w-full max-h-3/4 border-b border-border',
        bottom: 'bottom-0 left-0 w-full max-h-3/4 border-t border-border',
      },
    },
    defaults: { side: 'right' },
  });

  const flyParams = $derived(
    side === 'right'
      ? { x: 320, duration: 200, easing: cubicOut }
      : side === 'left'
        ? { x: -320, duration: 200, easing: cubicOut }
        : side === 'top'
          ? { y: -320, duration: 200, easing: cubicOut }
          : { y: 320, duration: 200, easing: cubicOut },
  );
</script>

{#if open}
  <div data-slot="sheet" role="dialog" aria-modal="true" data-side={side}>
    <div
      data-slot="sheet-overlay"
      class="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
      onclick={close}
      role="presentation"
    ></div>
    <div
      bind:this={contentEl}
      data-slot="sheet-content"
      class={cn(panel({ side }), className)}
      transition:fly={flyParams}
    >
      {#if children}{@render children()}{/if}
    </div>
  </div>
{/if}
