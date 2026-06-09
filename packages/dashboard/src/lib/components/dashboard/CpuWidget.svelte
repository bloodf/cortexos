<script lang="ts">
	import MetricCard from '$lib/components/ui/metric-card/MetricCard.svelte';
	import Sparkline from '$lib/components/ui/sparkline/Sparkline.svelte';
	import Cpu from '$lib/icons/Cpu.svelte';
	import { percent } from '$lib/utils/format';
	import type { SystemData } from '$lib/types/dashboard';
	import type { Messages } from '$lib/i18n';
	import { t } from '$lib/i18n';

	interface Props {
		system: SystemData | null;
		history: number[];
		messages: Messages;
	}

	let { system, history, messages }: Props = $props();

	const loadHint = $derived(
		system?.load.length
			? `load ${system.load.map((l) => l.toFixed(2)).join(' ')}`
			: undefined,
	);
</script>

<MetricCard
	label={t(messages, 'dashboard.widgets.cpu')}
	value={percent(system?.cpu ?? 0)}
	hint={loadHint}
	icon={Cpu}
	orientation="horizontal"
>
	{#snippet trend()}
		<div class="h-full w-full flex items-end">
			<Sparkline data={history} color="var(--chart-1)" width={200} height={64} />
		</div>
	{/snippet}
</MetricCard>
