<!--
  DropdownMenu — click-to-open menu with keyboard navigation (Arrow Up/Down to
  move between items, Escape to close, Enter/Space to activate).
-->
<script lang="ts" module>
  // Reserved for future top-level exports.
</script>

<script lang="ts">
  import { cn } from '$lib/utils/cn';
  import { tv } from '$lib/utils/tv';

  type DropdownMenuProps = {
    open?: boolean;
    children?: Snippet;
  };
  let { open = $bindable(false), children }: DropdownMenuProps = $props();

  function onKeydownGlobal(e: KeyboardEvent) {
    if (!open) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      open = false;
    }
  }
  $effect(() => {
    if (open) document.addEventListener('keydown', onKeydownGlobal);
    return () => document.removeEventListener('keydown', onKeydownGlobal);
  });

  const item = tv({
    base: 'flex cursor-default items-center gap-1.5 rounded-sm px-2 py-1 text-sm outline-none select-none focus:bg-accent focus:text-accent-foreground disabled:pointer-events-none disabled:opacity-50',
    variants: {
      variant: {
        default: '',
        destructive: 'text-destructive focus:bg-destructive/10 focus:text-destructive',
      },
    },
    defaults: { variant: 'default' },
  });
</script>

{#if open}
  <div
    data-slot="dropdown-menu"
    class="fixed inset-0 z-40"
    role="presentation"
    onclick={() => (open = false)}
  >
    <!-- svelte-ignore a11y_interactive_supports_focus -->
    <div
      data-slot="dropdown-menu-content"
      role="menu"
      tabindex="-1"
      class={cn(
        'absolute z-50 min-w-32 overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10',
      )}
      onclick={(e: MouseEvent) => e.stopPropagation()}
      onkeydown={(e: KeyboardEvent) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          const items = Array.from(
            (e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('[role="menuitem"]'),
          );
          if (items.length === 0) return;
          const idx = items.findIndex((i) => i === document.activeElement);
          const next = e.key === 'ArrowDown' ? (idx + 1) % items.length : (idx - 1 + items.length) % items.length;
          items[next].focus();
        }
      }}
    >
      {#if children}{@render children()}{/if}
    </div>
  </div>
{/if}
