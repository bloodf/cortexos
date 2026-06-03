<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';
  type Props = {
    title: string;
    description?: string;
    icon?: Snippet;
    actions?: Snippet;
    breadcrumb?: Snippet;
    class?: string;
  };
  let { title, description, icon, actions, breadcrumb, class: className }: Props = $props();
</script>

<header data-slot="page-header" class={cn('flex flex-col gap-3', className)}>
  {#if breadcrumb}
    <div data-slot="page-header-breadcrumb">{@render breadcrumb()}</div>
  {/if}
  <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
    <div class="flex items-start gap-3">
      {#if icon}
        <div class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground [&>svg]:size-5">
          {@render icon()}
        </div>
      {/if}
      <div class="flex flex-col gap-1">
        <h1 data-slot="page-header-title" class="text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        {#if description}
          <p data-slot="page-header-description" class="text-sm text-muted-foreground">{description}</p>
        {/if}
      </div>
    </div>
    {#if actions}
      <div data-slot="page-header-actions" class="flex shrink-0 items-center gap-2 sm:justify-end">
        {@render actions()}
      </div>
    {/if}
  </div>
</header>
