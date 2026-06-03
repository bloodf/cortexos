<!--
  Tabs — keyboard navigable tabs (Arrow Left/Right, Home/End).
-->
<script lang="ts" module>
  // Module-level reserved for future top-level exports.
</script>

<script lang="ts">
  import { cn } from '$lib/utils/cn';
  type Props = {
    value?: string;
    onchange?: (value: string) => void;
    class?: string;
    children?: Snippet;
  };
  let { value = $bindable(''), onchange, class: className, children }: Props = $props();
</script>

<!-- svelte-ignore a11y_interactive_supports_focus -->
<div
  data-slot="tabs"
  role="tablist"
  tabindex="-1"
  class={cn('inline-flex items-center gap-1', className)}
  onkeydown={(e: KeyboardEvent) => {
    const root = e.currentTarget as HTMLElement;
    const triggers = Array.from(root.querySelectorAll<HTMLElement>('[role="tab"]'));
    if (triggers.length === 0) return;
    const idx = triggers.findIndex((t) => t.getAttribute('data-state') === 'active');
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const next = triggers[(idx + 1) % triggers.length];
      next?.focus();
      next?.click();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prev = triggers[(idx - 1 + triggers.length) % triggers.length];
      prev?.focus();
      prev?.click();
    } else if (e.key === 'Home') {
      e.preventDefault();
      triggers[0]?.focus();
      triggers[0]?.click();
    } else if (e.key === 'End') {
      e.preventDefault();
      triggers[triggers.length - 1]?.focus();
      triggers[triggers.length - 1]?.click();
    }
  }}
>
  {#if children}{@render children()}{/if}
</div>
