<script lang="ts">
	import { cn } from '$lib/utils/cn';

	interface Props {
		data: number[];
		width?: number;
		height?: number;
		color?: string;
		fill?: boolean;
		class?: string;
	}

	let {
		data,
		width = 120,
		height = 36,
		color = 'var(--primary)',
		fill = true,
		class: className = '',
	}: Props = $props();

	const d = $derived.by(() => {
		if (!data.length) return '';
		const min = Math.min(...data);
		const max = Math.max(...data);
		const range = max - min || 1;
		const stepX = width / Math.max(1, data.length - 1);
		const pts = data.map((v, i) => [
			i * stepX,
			height - ((v - min) / range) * (height - 4) - 2,
		] as [number, number]);
		return pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ');
	});

	const area = $derived(d ? `${d} L${width},${height} L0,${height} Z` : '');
</script>

{#if data.length}
	<svg
		{width}
		{height}
		class={cn('block', className)}
		role="img"
		aria-label="Sparkline"
	>
		{#if fill}
			<path d={area} fill={color} opacity={0.12} />
		{/if}
		<path d={d} stroke={color} stroke-width={1.5} fill="none" />
	</svg>
{:else}
	<svg
		{width}
		{height}
		class={cn('block', className)}
		role="img"
		aria-label="Sparkline"
	/>
{/if}
