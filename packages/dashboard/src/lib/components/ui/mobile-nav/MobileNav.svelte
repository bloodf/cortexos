<!--
  MobileNav — bottom-tab nav for narrow viewports.
-->
<script lang="ts" module>
  export type MobileNavItem = {
    label: string;
    href: string;
    icon?: import('svelte').Snippet;
  };
</script>

<script lang="ts">
  import { cn } from '$lib/utils/cn';
  type Props = {
    items: MobileNavItem[];
    currentPath?: string;
    class?: string;
  };
  let { items, currentPath = '', class: className }: Props = $props();
</script>

<nav
  data-slot="mobile-nav"
  aria-label="Primary mobile"
  class={cn(
    'fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:hidden',
    className,
  )}
>
  {#each items as item (item.href)}
    {@const active = currentPath === item.href}
    <a
      href={item.href}
      aria-current={active ? 'page' : undefined}
      data-active={active}
      class={cn(
        'flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs transition-colors',
        active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {#if item.icon}
        <span class="[&>svg]:size-5" aria-hidden="true">{@render item.icon()}</span>
      {/if}
      <span>{item.label}</span>
    </a>
  {/each}
</nav>
