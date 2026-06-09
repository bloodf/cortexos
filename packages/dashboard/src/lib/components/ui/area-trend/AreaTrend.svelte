<script lang="ts">
	import { cn } from '$lib/utils/cn';

	type Series = { key: string; color: string; name: string };

	interface Props {
		data: Array<Record<string, number> & { t: number }>;
		series: Series[];
		yDomain?: [number, number];
		class?: string;
	}

	let { data, series, yDomain, class: className = '' }: Props = $props();

	let w = $state(0);
	let h = $state(0);
	let hoverIdx = $state<number | null>(null);
	let mouseX = $state(0);
	let mouseY = $state(0);

	const chartW = $derived(Math.max(0, w));
	const chartH = $derived(Math.max(0, h));

	const maxY = $derived.by(() => {
		if (yDomain) return yDomain[1];
		if (!data.length) return 100;
		const vals = data.flatMap((d) => series.map((s) => d[s.key] ?? 0));
		return Math.max(1, Math.max(...vals));
	});
	const minY = $derived(yDomain ? yDomain[0] : 0);

	function x(i: number) {
		if (data.length <= 1) return 0;
		return (i / (data.length - 1)) * chartW;
	}

	function y(v: number) {
		const range = maxY - minY || 1;
		return chartH - ((v - minY) / range) * chartH;
	}

	function areaPath(key: string) {
		if (!data.length || chartW === 0 || chartH === 0) return '';
		const pts = data.map((d, i) => [x(i), y(d[key] ?? 0)] as [number, number]);
		const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ');
		return `${line} L${chartW},${chartH} L0,${chartH} Z`;
	}

	function linePath(key: string) {
		if (!data.length || chartW === 0 || chartH === 0) return '';
		const pts = data.map((d, i) => [x(i), y(d[key] ?? 0)] as [number, number]);
		return pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ');
	}

	function onMove(e: MouseEvent) {
		const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
		mouseX = e.clientX - rect.left;
		mouseY = e.clientY - rect.top;
		if (!data.length || chartW === 0) {
			hoverIdx = null;
			return;
		}
		const idx = Math.round((mouseX / chartW) * (data.length - 1));
		hoverIdx = Math.min(data.length - 1, Math.max(0, idx));
	}

	function onLeave() {
		hoverIdx = null;
	}

	const tooltipLeft = $derived.by(() => {
		if (hoverIdx === null) return 0;
		const px = x(hoverIdx);
		return Math.min(chartW - 120, px + 8);
	});
	const tooltipTop = $derived(Math.max(0, mouseY - 8));
</script>

<div class={cn('relative h-full w-full min-h-0', className)} bind:clientWidth={w} bind:clientHeight={h}>
	<svg
		class="block h-full w-full"
		role="img"
		aria-label="Area trend"
		onmousemove={onMove}
		onmouseleave={onLeave}
	>
		{#each series as s (s.key)}
			<path d={areaPath(s.key)} fill={s.color} opacity={0.15} />
			<path d={linePath(s.key)} stroke={s.color} stroke-width={1.5} fill="none" />
		{/each}
		{#if hoverIdx !== null}
			<line
				x1={x(hoverIdx)}
				y1={0}
				x2={x(hoverIdx)}
				y2={chartH}
				stroke="currentColor"
				stroke-opacity={0.2}
			/>
		{/if}
	</svg>
	{#if hoverIdx !== null}
		<div
			class="absolute z-10 rounded-md border bg-card px-2 py-1 text-xs shadow"
			style="left: {tooltipLeft}px; top: {tooltipTop}px;"
		>
			{#each series as s}
				<div class="flex items-center gap-1">
					<span class="inline-block h-2 w-2 rounded-full" style="background: {s.color};"></span>
					<span>{s.name}: {Math.round(data[hoverIdx]?.[s.key] ?? 0)}</span>
				</div>
			{/each}
		</div>
	{/if}
</div>
