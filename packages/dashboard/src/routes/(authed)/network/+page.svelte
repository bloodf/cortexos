<script lang="ts">
	import type { PageData } from './$types';
	import type { NetworkData } from '$lib/types/dashboard';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import MetricCard from '$lib/components/ui/metric-card/MetricCard.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import {
		Table,
		TableHeader,
		TableBody,
		TableRow,
		TableHead,
		TableCell,
	} from '$lib/components/ui/table';
	import Network from '$lib/icons/Network.svelte';
	import ArrowDown from '$lib/icons/ArrowDown.svelte';
	import ArrowUp from '$lib/icons/ArrowUp.svelte';
	import { t } from '$lib/i18n';
	import { bytes, kbps } from '$lib/utils/format';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	const title = $derived(t(data.messages, 'app.nav.network'));

	// Seed once from the server load; fetchNetwork() polls fresh data.
	const initialNetwork: NetworkData = { interfaces: data.networkStats ?? [] };
	let networkData = $state<NetworkData>(initialNetwork);

	async function fetchNetwork() {
		try {
			const res = await fetch('/api/network', { credentials: 'include' });
			if (!res.ok) throw new Error('fetch failed');
			networkData = (await res.json()) as NetworkData;
		} catch {
			/* keep existing on error */
		}
	}

	$effect(() => {
		void fetchNetwork();
		const id = setInterval(() => void fetchNetwork(), 3000);
		return () => clearInterval(id);
	});

	const rxTotal = $derived(networkData.interfaces.reduce((a, i) => a + i.rxKbps, 0));
	const txTotal = $derived(networkData.interfaces.reduce((a, i) => a + i.txKbps, 0));
	const lifetimeRx = $derived(networkData.interfaces.reduce((a, i) => a + i.rxBytesTotal, 0));
	const lifetimeTx = $derived(networkData.interfaces.reduce((a, i) => a + i.txBytesTotal, 0));

	function ifaceStats(name: string) {
		return networkData.interfaces.find((n) => n.name === name);
	}
</script>

<svelte:head>
	<title>{title} · CortexOS</title>
</svelte:head>

<div class="flex flex-col gap-6">
	<PageHeader
		{title}
		description="Interfaces, Tailscale peers, firewall rules, and listeners."
		icon={Network}
	/>

	<section class="grid grid-cols-2 lg:grid-cols-4 gap-4" aria-label="Network metrics">
		<MetricCard label="Rx Total" value={kbps(rxTotal)} icon={ArrowDown} />
		<MetricCard label="Tx Total" value={kbps(txTotal)} icon={ArrowUp} />
		<MetricCard label="Lifetime Rx" value={bytes(lifetimeRx)} icon={ArrowDown} />
		<MetricCard label="Lifetime Tx" value={bytes(lifetimeTx)} icon={ArrowUp} />
	</section>

	<section class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Network interfaces">
		{#each data.interfaces as iface}
			{@const stats = ifaceStats(iface.ifname)}
			<Card>
				{#snippet title()}{iface.ifname}{/snippet}
				{#snippet description()}{iface.operstate ?? 'unknown'}{/snippet}
				<div class="flex flex-col gap-2 text-sm">
					{#if stats}
						<div class="flex items-center justify-between gap-2 text-xs">
							<span class="inline-flex items-center gap-1 text-muted-foreground">
								<ArrowDown class="h-3 w-3" /> Rx
							</span>
							<span class="tabular-nums">{kbps(stats.rxKbps)}</span>
						</div>
						<div class="flex items-center justify-between gap-2 text-xs">
							<span class="inline-flex items-center gap-1 text-muted-foreground">
								<ArrowUp class="h-3 w-3" /> Tx
							</span>
							<span class="tabular-nums">{kbps(stats.txKbps)}</span>
						</div>
						<div class="flex items-center justify-between gap-2 text-xs">
							<span class="inline-flex items-center gap-1 text-muted-foreground">
								<ArrowDown class="h-3 w-3" /> Total Rx
							</span>
							<span class="tabular-nums">{bytes(stats.rxBytesTotal)}</span>
						</div>
						<div class="flex items-center justify-between gap-2 text-xs">
							<span class="inline-flex items-center gap-1 text-muted-foreground">
								<ArrowUp class="h-3 w-3" /> Total Tx
							</span>
							<span class="tabular-nums">{bytes(stats.txBytesTotal)}</span>
						</div>
					{/if}
					{#if iface.addr_info && iface.addr_info.length > 0}
						<ul class="space-y-1">
							{#each iface.addr_info as addr}
								<li class="flex items-center gap-2">
									<span class="inline-flex rounded bg-muted px-1.5 py-0.5 text-xs font-medium">{addr.family}</span>
									<span class="font-mono tabular-nums">{addr.local}{addr.prefixlen !== undefined ? `/${addr.prefixlen}` : ''}</span>
								</li>
							{/each}
						</ul>
					{:else}
						<p class="text-muted-foreground">No addresses</p>
					{/if}
				</div>
			</Card>
		{:else}
			<Card>
				{#snippet title()}Interfaces{/snippet}
				{#snippet description()}No network interface data available{/snippet}
				<p class="text-sm text-muted-foreground">—</p>
			</Card>
		{/each}
	</section>

	<Card>
		{#snippet title()}Listening Ports{/snippet}
		{#snippet description()}TCP listeners from ss -tlnp{/snippet}
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead>State</TableHead>
					<TableHead>Local Address</TableHead>
					<TableHead>Port</TableHead>
					<TableHead>Process</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{#each data.ports as port}
					<TableRow>
						<TableCell>{port.state}</TableCell>
						<TableCell>{port.localAddress}</TableCell>
						<TableCell>{port.localPort}</TableCell>
						<TableCell>
							<span class="truncate max-w-[280px] block" title={port.process}>{port.process}</span>
						</TableCell>
					</TableRow>
				{:else}
					<TableRow>
						<TableCell colspan={4} class="text-center text-muted-foreground py-8">
							No listening port data available.
						</TableCell>
					</TableRow>
				{/each}
			</TableBody>
		</Table>
	</Card>
</div>
