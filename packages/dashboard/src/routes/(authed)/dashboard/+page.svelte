<script lang="ts">
	import type { PageData } from './$types';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import StatusHero from '$lib/components/status-hero/StatusHero.svelte';
	import Activity from '$lib/icons/Activity.svelte';
	import { t } from '$lib/i18n';
	import type { Messages } from '$lib/i18n';
	import type {
		SystemData,
		ProcessInfo,
		NetworkData,
		DockerContainer,
		IncusInstance,
		AlertHistory,
	} from '$lib/types/dashboard';
	import CpuWidget from '$lib/components/dashboard/CpuWidget.svelte';
	import MemoryWidget from '$lib/components/dashboard/MemoryWidget.svelte';
	import StorageWidget from '$lib/components/dashboard/StorageWidget.svelte';
	import CpuTempWidget from '$lib/components/dashboard/CpuTempWidget.svelte';
	import ServicesWidget from '$lib/components/dashboard/ServicesWidget.svelte';
	import UptimeWidget from '$lib/components/dashboard/UptimeWidget.svelte';
	import DockerWidget from '$lib/components/dashboard/DockerWidget.svelte';
	import IncusWidget from '$lib/components/dashboard/IncusWidget.svelte';
	import LiveTrendWidget from '$lib/components/dashboard/LiveTrendWidget.svelte';
	import SensorsWidget from '$lib/components/dashboard/SensorsWidget.svelte';
	import ProcessesWidget from '$lib/components/dashboard/ProcessesWidget.svelte';
	import NetworkWidget from '$lib/components/dashboard/NetworkWidget.svelte';
	import AlertsWidget from '$lib/components/dashboard/AlertsWidget.svelte';
	import DrivesWidget from '$lib/components/dashboard/DrivesWidget.svelte';
	import DatabasesWidget from '$lib/components/dashboard/DatabasesWidget.svelte';
	import MonitoringWidget from '$lib/components/dashboard/MonitoringWidget.svelte';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();
	const messages = $derived(data.messages);

	let system = $state<SystemData | null>(null);
	let processes = $state<ProcessInfo[]>([]);
	let network = $state<NetworkData | null>(null);
	let services = $state<any[]>([]);
	let alerts = $state<AlertHistory[]>([]);
	let dockerContainers = $state<DockerContainer[]>([]);
	let incusInstances = $state<IncusInstance[]>([]);

	const HISTORY_SIZE = 40;
	let cpuHistory = $state<number[]>([]);
	let memHistory = $state<number[]>([]);
	let rxHistory = $state<number[]>([]);
	let txHistory = $state<number[]>([]);

	function pushValue(arr: number[], val: number) {
		const next = [...arr, val];
		if (next.length > HISTORY_SIZE) next.shift();
		return next;
	}

	function updateHistories(sys: SystemData | null, net: NetworkData | null) {
		if (sys) {
			cpuHistory = pushValue(cpuHistory, sys.cpu);
			memHistory = pushValue(memHistory, sys.memory.percent);
		}
		if (net) {
			const rx = net.interfaces.reduce((a, i) => a + i.rxKbps, 0);
			const tx = net.interfaces.reduce((a, i) => a + i.txKbps, 0);
			rxHistory = pushValue(rxHistory, rx);
			txHistory = pushValue(txHistory, tx);
		}
	}

	let lastUpdated = $state<Date | null>(null);
	let pollError = $state<string | null>(null);
	let isPolling = $state(true);

	async function fetchJson<T>(url: string): Promise<T> {
		const r = await fetch(url, { credentials: 'include' });
		if (!r.ok) {
			const body = await r.text().catch(() => '');
			throw new Error(`${r.status} ${r.statusText}${body ? ': ' + body.slice(0, 200) : ''}`);
		}
		return (await r.json()) as T;
	}

	async function tick() {
		if (!isPolling) return;
		try {
			const [sys, procsRes, net, svcRes, alRes, dockRes, incRes] = await Promise.all([
				fetchJson<SystemData>('/api/system'),
				fetchJson<{ processes: ProcessInfo[] }>('/api/processes'),
				fetchJson<NetworkData>('/api/network'),
				fetchJson<{ services: any[] }>('/api/services'),
				fetchJson<{ alerts: AlertHistory[] }>('/api/alerts/history'),
				fetchJson<{ containers: DockerContainer[] }>('/api/docker/containers'),
				fetchJson<{ instances: IncusInstance[] }>('/api/incus/instances'),
			]);
			if (sys) system = sys;
			if (procsRes) processes = procsRes.processes ?? [];
			if (net) network = net;
			if (svcRes) services = svcRes.services ?? [];
			if (alRes) alerts = alRes.alerts ?? [];
			if (dockRes) dockerContainers = dockRes.containers ?? [];
			if (incRes) incusInstances = incRes.instances ?? [];
			updateHistories(sys ?? null, net ?? null);
			lastUpdated = new Date();
			pollError = null;
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			pollError = msg;
			// eslint-disable-next-line no-console
			console.error('[dashboard poll]', msg);
		}
	}

	$effect(() => {
		void tick();
		const id = setInterval(() => void tick(), 3000);
		return () => clearInterval(id);
	});
</script>

<svelte:head>
	<title>{t(messages, 'dashboard.title')} · CortexOS</title>
</svelte:head>

<div class="flex flex-col gap-5" data-testid="dashboard-welcome">
	<PageHeader
		title={t(messages, 'dashboard.title')}
		description={t(messages, 'dashboard.subtitle')}
		icon={Activity}
	/>

	<div class="flex items-center gap-3 text-xs">
		{#if pollError}
			<span class="inline-flex items-center gap-1.5 text-red-500">
				<span class="relative flex h-2 w-2">
					<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
					<span class="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
				</span>
				Polling error: {pollError}
			</span>
		{:else if lastUpdated}
			<span class="inline-flex items-center gap-1.5 text-emerald-500">
				<span class="relative flex h-2 w-2">
					<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
					<span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
				</span>
				Live — updated {lastUpdated.toLocaleTimeString()}
			</span>
		{:else}
			<span class="inline-flex items-center gap-1.5 text-muted-foreground">
				<span class="h-2 w-2 rounded-full bg-muted-foreground animate-pulse"></span>
				Loading…
			</span>
		{/if}
	</div>

	<StatusHero {services} {system} />

	<section
		class="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-3 auto-rows-[3.5rem]"
		aria-label="Dashboard widgets"
	>
		<div class="col-span-4 sm:col-span-4 lg:col-span-4 row-span-2 min-h-0">
			<CpuWidget {system} history={cpuHistory} {messages} />
		</div>
		<div class="col-span-4 sm:col-span-4 lg:col-span-4 row-span-2 min-h-0">
			<MemoryWidget {system} history={memHistory} {messages} />
		</div>
		<div class="col-span-2 sm:col-span-2 lg:col-span-2 row-span-2 min-h-0">
			<StorageWidget {system} {messages} />
		</div>
		<div class="col-span-2 sm:col-span-2 lg:col-span-2 row-span-2 min-h-0">
			<CpuTempWidget {system} {messages} />
		</div>
		<div class="col-span-2 sm:col-span-2 lg:col-span-2 row-span-2 min-h-0">
			<UptimeWidget {system} {messages} />
		</div>
		<div class="col-span-2 sm:col-span-2 lg:col-span-2 row-span-2 min-h-0">
			<DockerWidget containers={dockerContainers} {messages} />
		</div>
		<div class="col-span-2 sm:col-span-2 lg:col-span-2 row-span-2 min-h-0">
			<IncusWidget instances={incusInstances} {messages} />
		</div>
		<div class="col-span-2 sm:col-span-2 lg:col-span-2 row-span-2 min-h-0">
			<ServicesWidget {services} {messages} />
		</div>
		<div class="col-span-4 sm:col-span-6 lg:col-span-4 row-span-2 min-h-0">
			<SensorsWidget {system} {messages} />
		</div>
		<div class="col-span-4 sm:col-span-6 lg:col-span-8 row-span-5 min-h-0">
			<LiveTrendWidget cpuHistory={cpuHistory} memHistory={memHistory} {messages} />
		</div>
		<div class="col-span-4 sm:col-span-6 lg:col-span-4 row-span-4 min-h-0">
			<AlertsWidget alerts={alerts} {messages} />
		</div>
		<div class="col-span-4 sm:col-span-6 lg:col-span-4 row-span-4 min-h-0">
			<DatabasesWidget {services} {messages} />
		</div>
		<div class="col-span-4 sm:col-span-6 lg:col-span-4 row-span-4 min-h-0">
			<MonitoringWidget {services} {messages} />
		</div>
		<div class="col-span-4 sm:col-span-6 lg:col-span-8 row-span-5 min-h-0">
			<NetworkWidget {network} rxHistory={rxHistory} txHistory={txHistory} {messages} />
		</div>
		<div class="col-span-4 sm:col-span-6 lg:col-span-8 row-span-5 min-h-0">
			<ProcessesWidget {processes} {messages} />
		</div>
		<div class="col-span-4 sm:col-span-6 lg:col-span-4 row-span-5 min-h-0">
			<DrivesWidget {system} {messages} />
		</div>
	</section>
</div>
