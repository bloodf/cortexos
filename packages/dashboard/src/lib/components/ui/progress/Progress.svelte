<!--
  Progress — horizontal progress bar. Native <progress> under the hood for
  full a11y support.
-->
<script lang="ts">
  import { cn } from '$lib/utils/cn';
  type Props = {
    value: number;
    max?: number;
    class?: string;
    'aria-label'?: string;
  };
  let { value, max = 100, class: className, ...aria }: Props = $props();
  const pct = $derived(Math.max(0, Math.min(100, (value / max) * 100)));
</script>

<progress
  data-slot="progress"
  {value}
  {max}
  class={cn(
    'h-2 w-full appearance-none overflow-hidden rounded-full bg-secondary',
    '[&::-webkit-progress-bar]:bg-secondary [&::-webkit-progress-value]:bg-primary [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:transition-all',
    '[&::-moz-progress-bar]:bg-primary',
    className,
  )}
  {...aria}
  aria-valuenow={value}
  aria-valuemin={0}
  aria-valuemax={max}
></progress>
<span data-slot="progress-label" class="sr-only">{pct.toFixed(0)}%</span>
