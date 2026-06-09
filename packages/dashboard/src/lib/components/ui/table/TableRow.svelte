<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';
  import { cn } from '$lib/utils/cn';
  let { class: className, children, ...rest }: HTMLAttributes<HTMLTableRowElement> & { children?: Snippet } = $props();
</script>

<tr data-slot="table-row" class={cn('border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted', className)} {...rest}>
  {#if children}{@render children()}{/if}
</tr>
