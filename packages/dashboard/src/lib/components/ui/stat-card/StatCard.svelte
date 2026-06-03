<!--
  StatCard — label + value + optional delta + optional sparkline. Pure SVG
  sparkline (no recharts dependency).
-->
<script module lang="ts">
  export type SparklinePoint = { value: number };
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';
  import { tv } from '$lib/utils/tv';
  import { Card, CardHeader, CardTitle, CardBody } from '../card';

  type DeltaTrend = 'up' | 'down' | 'neutral';
  type Props = {
    label: string;
    value: string | number;
    delta?: string;
    deltaTrend?: DeltaTrend;
    sparkline?: SparklinePoint[];
    icon?: Snippet;
    class?: string;
  };
  let {
    label,
    value,
    delta,
    deltaTrend = 'neutral',
    sparkline,
    icon,
    class: className,
  }: Props = $props();

  const deltaClasses = tv({
    base: 'inline-flex items-center gap-0.5 rounded-full px-1.5 text-xs font-medium',
    variants: {
      trend: {
        up: 'bg-success/10 text-success',
        down: 'bg-destructive/10 text-destructive',
        neutral: 'bg-muted text-muted-foreground',
      },
    },
    defaults: { trend: 'neutral' },
  });

  // Compute the sparkline path (line) and area path.
  const sparkPath = $derived.by(() => {
    if (!sparkline || sparkline.length < 2) return null;
    const w = 100;
    const h = 32;
    const min = Math.min(...sparkline.map((p) => p.value));
    const max = Math.max(...sparkline.map((p) => p.value));
    const range = max - min || 1;
    return sparkline
      .map((p, i) => {
        const x = (i / (sparkline.length - 1)) * w;
        const y = h - ((p.value - min) / range) * h;
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(' ');
  });
  const sparkArea = $derived.by(() => {
    if (!sparkPath) return null;
    return `${sparkPath} L100,32 L0,32 Z`;
  });
</script>

<div data-slot="stat-card">
  <Card size="sm" class={cn('gap-1.5', className)}>
  <CardHeader>
    <CardTitle class="text-sm font-medium text-muted-foreground">{label}</CardTitle>
    {#if icon}
      <div class="ml-auto text-muted-foreground [&>svg]:size-4" aria-hidden="true">
        {@render icon()}
      </div>
    {/if}
  </CardHeader>
  <CardBody class="flex flex-col gap-2">
    <div class="flex items-end justify-between gap-3">
      <span data-slot="stat-card-value" class="text-2xl font-semibold tabular-nums tracking-tight text-foreground">
        {value}
      </span>
      {#if delta != null}
        <span class={deltaClasses({ trend: deltaTrend })}>
          {deltaTrend === 'up' ? '↑' : deltaTrend === 'down' ? '↓' : ''}
          {delta}
        </span>
      {/if}
    </div>
    {#if sparkPath}
      <svg
        data-slot="stat-card-sparkline"
        viewBox="0 0 100 32"
        preserveAspectRatio="none"
        class="h-8 w-full"
        aria-hidden="true"
      >
        <path d={sparkArea} fill="var(--chart-1)" fill-opacity="0.15" />
        <path d={sparkPath} fill="none" stroke="var(--chart-1)" stroke-width="1.5" />
      </svg>
    {/if}
  </CardBody>
</Card>
</div>
