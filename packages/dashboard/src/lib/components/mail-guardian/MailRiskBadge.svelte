<script lang="ts">
	import Badge from '$lib/components/ui/badge/Badge.svelte';
	import AlertTriangle from '$lib/icons/AlertTriangle.svelte';

	type Risk = 'low' | 'medium' | 'high';

	interface Props {
		verdict: string;
		size?: 'default' | 'sm';
	}

	let { verdict, size = 'default' }: Props = $props();

	function riskFromVerdict(verdict: string): Risk {
		const v = verdict.toLowerCase();
		if (v === 'spam') return 'high';
		if (v === 'uncertain') return 'medium';
		return 'low';
	}

	const risk = $derived(riskFromVerdict(verdict));

	const variantMap: Record<Risk, 'success' | 'warning' | 'destructive'> = {
		low: 'success',
		medium: 'warning',
		high: 'destructive',
	};
</script>

<Badge variant={variantMap[risk]} {size}>
	{#if risk === 'high'}
		<AlertTriangle class="size-3" />
	{/if}
	<span class="uppercase">{risk}</span>
</Badge>
