<script lang="ts">
  import { cn } from '$lib/utils/cn';
  type Props = {
    class?: string;
    width?: string;
    height?: string;
  };
  let { class: className, width, height }: Props = $props();
</script>

<div
  data-slot="skeleton"
  class={cn('animate-pulse rounded-md bg-muted', className)}
  style:width={width}
  style:height={height}
  aria-busy="true"
  aria-live="polite"
></div>
