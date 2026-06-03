<!--
  Breadcrumb — accessible nav trail. Current page is marked aria-current=page.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';
  type Crumb = { label: string; href?: string };
  type Props = {
    items: Crumb[];
    class?: string;
    separator?: Snippet;
  };
  let { items, class: className, separator }: Props = $props();
</script>

<nav data-slot="breadcrumb" aria-label="Breadcrumb" class={cn('text-sm', className)}>
  <ol class="flex flex-wrap items-center gap-1">
    {#each items as item, i (i)}
      <li class="flex items-center gap-1">
        {#if i > 0}
          <span class="text-muted-foreground" aria-hidden="true">/</span>
        {/if}
        {#if item.href && i < items.length - 1}
          <a href={item.href} class="text-muted-foreground hover:text-foreground">{item.label}</a>
        {:else}
          <span aria-current={i === items.length - 1 ? 'page' : undefined} class="font-medium text-foreground">
            {item.label}
          </span>
        {/if}
        {#if separator && i < items.length - 1}
          {@render separator()}
        {/if}
      </li>
    {/each}
  </ol>
</nav>
