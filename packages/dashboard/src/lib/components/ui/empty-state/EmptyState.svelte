<!--
  EmptyState — placeholder for "no data" sections.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';
  type Props = {
    title?: string;
    description?: string;
    icon?: Snippet;
    action?: Snippet;
    class?: string;
    children?: Snippet;
  };
  let { title, description, icon, action, class: className, children }: Props = $props();
</script>

<div
  data-slot="empty-state"
  class={cn('flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-8 text-center', className)}
>
  {#if icon}
    <div class="text-muted-foreground [&>svg]:size-10">
      {@render icon()}
    </div>
  {/if}
  {#if title}
    <h3 data-slot="empty-state-title" class="text-sm font-semibold">{title}</h3>
  {/if}
  {#if description}
    <p data-slot="empty-state-description" class="text-sm text-muted-foreground">{description}</p>
  {/if}
  {#if action}
    <div class="mt-2">
      {@render action()}
    </div>
  {/if}
  {#if children}
    {@render children()}
  {/if}
</div>
