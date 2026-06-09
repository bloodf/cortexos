<script lang="ts">
	import WidgetShell from '$lib/components/ui/widget-shell/WidgetShell.svelte';
	import AreaTrend from '$lib/components/ui/area-trend/AreaTrend.svelte';
	import Activity from '$lib/icons/Activity.svelte';
	import type { Messages } from '$lib/i18n';
	import { t } from '$lib/i18n';

	interface Props {
		cpuHistory: number[];
		memHistory: number[];
		messages: Messages;
	}

	let { cpuHistory, memHistory, messages }: Props = $props();

	const data = $derived(
		cpuHistory.map((cpu, i) => ({ t: i, cpu, mem: memHistory[i] ?? 0 })),
	);
</script>

<WidgetShell title={t(messages, 'dashboard.widgets.live')} icon={Activity} bodyClassName="px-2 pb-2">
	<div class="h-full w-full min-h-0">
		<AreaTrend
			{data}
			series={[
				{ key: 'cpu', color: 'var(--chart-1)', name: 'CPU %' },
				{ key: 'mem', color: 'var(--chart-2)', name: 'Memory %' },
			]}
			yDomain={[0, 100]}
		/>
	</div>
</WidgetShell>
