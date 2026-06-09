<script lang="ts">
	import MetricCard from '$lib/components/ui/metric-card/MetricCard.svelte';
	import Sparkline from '$lib/components/ui/sparkline/Sparkline.svelte';
	import MemoryStick from '$lib/icons/MemoryStick.svelte';
	import { percent, bytes } from '$lib/utils/format';
	import type { SystemData } from '$lib/types/dashboard';
	import type { Messages } from '$lib/i18n';
	import { t } from '$lib/i18n';

	interface Props {
		system: SystemData | null;
		history: number[];
		messages: Messages;
	}

	let { system, history, messages }: Props = $props();
</script>

<MetricCard
	label={t(messages, 'dashboard.widgets.memory')}
	value={percent(system?.memory.percent ?? 0)}
	hint={`${bytes(system?.memory.used ?? 0)} / ${bytes(system?.memory.total ?? 0)}`}
	icon={MemoryStick}
	orientation="horizontal"
>
	{#snippet trend()}
		<div class="h-full w-full flex items-end">
			<Sparkline data={history} color="var(--chart-2)" width={200} height={64} />
		</div>
	{/snippet}
</MetricCard>
