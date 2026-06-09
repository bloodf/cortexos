<script lang="ts">
	import WidgetShell from '$lib/components/ui/widget-shell/WidgetShell.svelte';
	import AreaTrend from '$lib/components/ui/area-trend/AreaTrend.svelte';
	import Wifi from '$lib/icons/Wifi.svelte';
	import ArrowDown from '$lib/icons/ArrowDown.svelte';
	import ArrowUp from '$lib/icons/ArrowUp.svelte';
	import { kbps } from '$lib/utils/format';
	import type { NetworkData } from '$lib/types/dashboard';
	import type { Messages } from '$lib/i18n';
	import { t } from '$lib/i18n';

	interface Props {
		network: NetworkData | null;
		rxHistory: number[];
		txHistory: number[];
		messages: Messages;
	}

	let { network, rxHistory, txHistory, messages }: Props = $props();

	const rxNow = $derived(network?.interfaces.reduce((a, i) => a + i.rxKbps, 0) ?? 0);
	const txNow = $derived(network?.interfaces.reduce((a, i) => a + i.txKbps, 0) ?? 0);
	const data = $derived(
		rxHistory.map((rx, i) => ({ t: i, rx, tx: txHistory[i] ?? 0 })),
	);
</script>

<WidgetShell title={t(messages, 'dashboard.widgets.network')} icon={Wifi} bodyClassName="px-2 pb-2">
	<div class="h-full grid grid-cols-[minmax(0,9rem)_1fr] gap-3 min-h-0">
		<div class="flex flex-col gap-2 min-w-0">
			<div class="rounded-md border p-2 min-w-0">
				<p class="text-[10px] uppercase text-muted-foreground flex items-center gap-1">
					<ArrowDown class="h-3 w-3" />
					Rx
				</p>
				<p class="text-base font-semibold tabular-nums truncate">{kbps(rxNow)}</p>
			</div>
			<div class="rounded-md border p-2 min-w-0">
				<p class="text-[10px] uppercase text-muted-foreground flex items-center gap-1">
					<ArrowUp class="h-3 w-3" />
					Tx
				</p>
				<p class="text-base font-semibold tabular-nums truncate">{kbps(txNow)}</p>
			</div>
			<div class="flex-1 min-h-0 overflow-auto space-y-1 pt-1">
				{#each network?.interfaces ?? [] as i (i.name)}
					<div class="flex items-center justify-between gap-2 text-[11px]">
						<span class="font-mono text-muted-foreground flex items-center gap-1 truncate">
							<Wifi class="h-3 w-3 shrink-0" />
							{i.name}
						</span>
						<span class="tabular-nums shrink-0">{kbps(i.rxKbps + i.txKbps)}</span>
					</div>
				{/each}
			</div>
		</div>
		<div class="min-w-0 min-h-0">
			<AreaTrend
				{data}
				series={[
					{ key: 'rx', color: 'var(--chart-1)', name: 'Rx' },
					{ key: 'tx', color: 'var(--chart-2)', name: 'Tx' },
				]}
			/>
		</div>
	</div>
</WidgetShell>
