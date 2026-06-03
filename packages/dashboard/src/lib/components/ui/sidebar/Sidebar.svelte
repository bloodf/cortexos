<!--
  Sidebar — collapsible primary nav. Items are configured externally.
-->
<script lang="ts" module>
  export type NavItem = {
    label: string;
    href: string;
    icon?: import('svelte').Snippet;
  };
  export type NavGroup = {
    title: string;
    items: NavItem[];
  };
</script>

<script lang="ts">
  import { cn } from '$lib/utils/cn';
  type Props = {
    groups: NavGroup[];
    currentPath?: string;
    collapsed?: boolean;
    onnavigate?: (href: string) => void;
    class?: string;
  };
  let { groups, currentPath = '', collapsed = false, onnavigate, class: className }: Props = $props();
</script>

<aside
  data-slot="sidebar"
  aria-label="Primary"
  class={cn(
    'flex h-full flex-col gap-2 border-r border-sidebar-border bg-sidebar text-sidebar-foreground',
    collapsed ? 'w-14' : 'w-60',
    'transition-all',
    className,
  )}
>
  {#each groups as group, gi (group.title)}
    <div class="px-2 pt-2">
      {#if !collapsed}
        <p class="px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {group.title}
        </p>
      {/if}
      <ul class="mt-1 flex flex-col gap-0.5">
        {#each group.items as item (item.href)}
          {@const active = currentPath === item.href}
          <li>
            <a
              href={item.href}
              aria-current={active ? 'page' : undefined}
              data-active={active}
              onclick={(e: MouseEvent) => {
                if (onnavigate) {
                  e.preventDefault();
                  onnavigate(item.href);
                }
              }}
              class={cn(
                'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
                active ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'hover:bg-sidebar-accent/50',
                collapsed ? 'justify-center' : '',
              )}
              title={collapsed ? item.label : undefined}
            >
              {#if item.icon}
                <span class="shrink-0 [&>svg]:size-4" aria-hidden="true">{@render item.icon()}</span>
              {/if}
              {#if !collapsed}
                <span class="truncate">{item.label}</span>
              {/if}
            </a>
          </li>
        {/each}
      </ul>
    </div>
  {/each}
</aside>
