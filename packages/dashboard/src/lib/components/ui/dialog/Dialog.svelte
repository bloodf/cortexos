<!--
  Dialog — modal dialog with focus trap and Escape-to-close.

  Usage:
    <Dialog open={isOpen} onclose={() => isOpen = false}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Are you sure?</DialogTitle>
          <DialogDescription>This action cannot be undone.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onclick={() => isOpen = false}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
-->
<script lang="ts" module>
  // Focus trap: collects focusable elements within a container and wraps Tab.
  export function trapFocus(container: HTMLElement): () => void {
    const focusableSelector =
      'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusables = () =>
      Array.from(container.querySelectorAll<HTMLElement>(focusableSelector));
    function onKeydown(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) return;
      // items.length > 0 is guaranteed by the early return above.
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
    container.addEventListener('keydown', onKeydown);
    return () => container.removeEventListener('keydown', onKeydown);
  }
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import { onMount, onDestroy } from 'svelte';
  import { tv } from '$lib/utils/tv';
  import { cn } from '$lib/utils/cn';

  type DialogProps = {
    open?: boolean;
    onclose?: () => void;
    children?: Snippet;
    class?: string;
  };
  let { open = $bindable(false), onclose, children, class: className }: DialogProps = $props();

  let contentEl: HTMLDivElement | undefined = $state();
  let releaseTrap: (() => void) | undefined;

  function close() {
    open = false;
    onclose?.();
  }

  function onOverlayClick() {
    close();
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
      // Move focus into the dialog after mount
      queueMicrotask(() => {
        if (contentEl) {
          releaseTrap = trapFocus(contentEl);
          const focusable = contentEl.querySelector<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
          );
          focusable?.focus();
        }
      });
    } else {
      document.removeEventListener('keydown', onKeydownGlobal);
      document.body.style.overflow = '';
      releaseTrap?.();
      releaseTrap = undefined;
    }
    return () => {
      document.removeEventListener('keydown', onKeydownGlobal);
      document.body.style.overflow = '';
      releaseTrap?.();
    };
  });

  const dialogContent = tv({
    base: 'fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 outline-none sm:max-w-md',
  });
</script>

{#if open}
  <div data-slot="dialog" role="dialog" aria-modal="true">
    <div
      data-slot="dialog-overlay"
      class="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
      onclick={onOverlayClick}
      role="presentation"
    ></div>
    <div bind:this={contentEl} data-slot="dialog-content" class={cn(dialogContent(), className)}>
      {#if children}{@render children()}{/if}
    </div>
  </div>
{/if}
