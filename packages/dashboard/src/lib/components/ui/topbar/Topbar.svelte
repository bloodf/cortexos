<!--
  Topbar — header row with search, theme switcher, user menu slots.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';
  type Props = {
    search?: Snippet;
    theme?: Snippet;
    user?: Snippet;
    actions?: Snippet;
    class?: string;
  };
  let { search, theme, user, actions, class: className }: Props = $props();
</script>

<header
  data-slot="topbar"
  class={cn(
    'flex h-12 items-center gap-2 border-b border-border bg-background px-3',
    className,
  )}
>
  {#if search}
    <div data-slot="topbar-search" class="flex-1 max-w-md">
      {@render search()}
    </div>
  {/if}
  <div class="ml-auto flex items-center gap-2">
    {#if actions}{@render actions()}{/if}
    {#if theme}{@render theme()}{/if}
    {#if user}{@render user()}{/if}
  </div>
</header>
