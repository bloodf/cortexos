<script lang="ts">
	import type { PageData } from './$types';
	import type { Service } from '@cortexos/contracts';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import Card from '$lib/components/ui/card/Card.svelte';
	import CardHeader from '$lib/components/ui/card/CardHeader.svelte';
	import CardTitle from '$lib/components/ui/card/CardTitle.svelte';
	import CardBody from '$lib/components/ui/card/CardBody.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import DataTable from '$lib/components/ui/data-table/DataTable.svelte';
	import type { Column, SortDir } from '$lib/components/ui/data-table/DataTable.types';
	import Activity from '$lib/icons/Activity.svelte';
	import StatusBadge from '$lib/components/ui/status-badge/StatusBadge.svelte';
	import TechIcon from '$lib/components/ui/tech-icon/TechIcon.svelte';
	import IncidentTimeline from '$lib/components/ui/incident-timeline/IncidentTimeline.svelte';
	import type { AlertHistoryItem } from '$lib/components/ui/incident-timeline/IncidentTimeline.svelte';
	import LogStream from '$lib/components/ui/log-stream/LogStream.svelte';
	import { t } from '$lib/i18n';
	import type { ServiceStatusLit } from '$lib/components/services/adapter';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	let period = $state<'1h' | '24h' | '7d'>('24h');
	let rechecking = $state<Set<string>>(new Set());
	let rows = $state<Service[]>([]);

	$effect(() => {
		rows = data.services;
	});

	const isAdmin = $derived(Boolean(data.user?.isAdmin));

	const columns: Column<Record<string, unknown>>[] = $derived([
		{
			key: 'name',
			header: t(data.messages, 'healthcheck.table.service'),
			sortable: true,
			cell: serviceCell,
		},
		{
			key: 'category',
			header: t(data.messages, 'healthcheck.table.category'),
			sortable: true,
		},
		{
			key: 'status',
			header: t(data.messages, 'healthcheck.table.status'),
			sortable: true,
			cell: statusCell,
		},
		{
			key: 'responseMs',
			header: t(data.messages, 'healthcheck.table.latency'),
			sortable: true,
			cell: latencyCell,
		},
		{
			key: 'healthType',
			header: t(data.messages, 'healthcheck.table.type'),
			sortable: true,
			cell: typeCell,
		},
		{
			key: 'slug',
			header: '',
			cell: actionCell,
		},
	]);

	async function recheck(s: Service) {
		if (rechecking.has(s.slug)) return;
		rechecking = new Set([...rechecking, s.slug]);
		try {
			const res = await fetch(`/api/services/${s.slug}/health`, {
				method: 'POST',
				credentials: 'include',
				headers: {
					'Content-Type': 'application/json',
					'X-CSRF-Token': data.session?.csrfToken ?? '',
				},
				body: JSON.stringify({ source: 'manual' }),
			});
			if (!res.ok) return;
			const payload = (await res.json()) as {
				snapshot?: { status?: string; responseMs?: number | null };
			};
			const snap = payload.snapshot;
			if (!snap) return;
			rows = rows.map((r) =>
				r.slug === s.slug
					? {
							...r,
							status: (snap.status as Service['status']) ?? r.status,
							responseMs: snap.responseMs ?? null,
						}
					: r
			);
		} finally {
			rechecking = new Set([...rechecking].filter((x) => x !== s.slug));
		}
	}

	const title = $derived(t(data.messages, 'app.nav.healthcheck'));
	const description = $derived(t(data.messages, 'healthcheck.description'));
	const incidentTitle = $derived(t(data.messages, 'healthcheck.incidentTimeline'));
	const logTitle = $derived(t(data.messages, 'healthcheck.liveLogStream'));
	const periods = $derived([
		{ value: '1h' as const, label: t(data.messages, 'healthcheck.period.1h') },
		{ value: '24h' as const, label: t(data.messages, 'healthcheck.period.24h') },
		{ value: '7d' as const, label: t(data.messages, 'healthcheck.period.7d') },
	]);

	const summary = $derived({
		online: rows.filter((s) => s.status === 'online').length,
		offline: rows.filter((s) => s.status === 'offline').length,
		unknown: rows.filter((s) => s.status === 'unknown').length,
		total: rows.length,
	});
</script>

<svelte:head>
	<title>{title} · CortexOS</title>
</svelte:head>

<div class="flex flex-col gap-5">
	<PageHeader {title} {description} icon={Activity}>
		{#snippet actions()}
			<div class="flex gap-1 rounded-md border p-0.5 bg-muted/30">
				{#each periods as p (p.value)}
					<Button
						size="sm"
						variant={period === p.value ? 'default' : 'ghost'}
						onclick={() => (period = p.value)}
						class="h-7 px-3"
					>
						{p.label}
					</Button>
				{/each}
			</div>
		{/snippet}
	</PageHeader>

	<!-- Status summary bar -->
	<div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
		<Card class="p-3">
			<p class="text-[10px] uppercase tracking-wide text-muted-foreground">Total</p>
			<p class="text-2xl font-semibold tabular-nums">{summary.total}</p>
		</Card>
		<Card class="p-3 border-success/30 bg-success/5">
			<p class="text-[10px] uppercase tracking-wide text-muted-foreground">Online</p>
			<p class="text-2xl font-semibold tabular-nums text-success">{summary.online}</p>
		</Card>
		<Card class="p-3 border-destructive/30 bg-destructive/5">
			<p class="text-[10px] uppercase tracking-wide text-muted-foreground">Offline</p>
			<p class="text-2xl font-semibold tabular-nums text-destructive">{summary.offline}</p>
		</Card>
		<Card class="p-3 border-warning/30 bg-warning/5">
			<p class="text-[10px] uppercase tracking-wide text-muted-foreground">Unknown</p>
			<p class="text-2xl font-semibold tabular-nums text-warning">{summary.unknown}</p>
		</Card>
	</div>

	<DataTable
		columns={columns}
		data={rows as unknown as Record<string, unknown>[]}
		initialSort={{ key: 'status', dir: 'asc' as SortDir }}
		pageSize={25}
	/>

	<Card>
		<CardHeader>
			<CardTitle class="text-sm">{incidentTitle}</CardTitle>
		</CardHeader>
		<CardBody>
			<IncidentTimeline alerts={data.alerts as AlertHistoryItem[]} />
		</CardBody>
	</Card>

	<Card>
		<CardHeader>
			<CardTitle class="text-sm">{logTitle}</CardTitle>
		</CardHeader>
		<CardBody>
			<LogStream height={360} />
		</CardBody>
	</Card>
</div>

{#snippet serviceCell(row: Record<string, unknown>, _index: number)}
	{@const s = row as unknown as Service}
	<div class="flex items-center gap-2">
		<TechIcon name={s.name} slug={s.slug} size={24} image={s.icon?.image} />
		<div class="min-w-0">
			<p class="font-medium truncate">{s.name}</p>
			<p class="text-[10px] text-muted-foreground font-mono truncate">{s.healthUrl}</p>
		</div>
	</div>
{/snippet}

{#snippet statusCell(row: Record<string, unknown>, _index: number)}
	{@const s = row as unknown as Service}
	<StatusBadge status={s.status as ServiceStatusLit} messages={data.messages} />
{/snippet}

{#snippet latencyCell(row: Record<string, unknown>, _index: number)}
	{@const ms = (row as unknown as Service).responseMs}
	<span class="text-right tabular-nums">{ms == null ? '—' : `${Math.round(ms)} ms`}</span>
{/snippet}

{#snippet typeCell(row: Record<string, unknown>, _index: number)}
	<span class="text-xs font-mono">{(row as unknown as Service).healthType}</span>
{/snippet}

{#snippet actionCell(row: Record<string, unknown>, _index: number)}
	{@const s = row as unknown as Service}
	<Button
		size="sm"
		variant="ghost"
		onclick={() => recheck(s)}
		disabled={!isAdmin || rechecking.has(s.slug)}
		loading={rechecking.has(s.slug)}
		ariaLabel={t(data.messages, 'healthcheck.recheckAria')}
	>
		<svg
			viewBox="0 0 24 24"
			class="h-3.5 w-3.5"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
		>
			<path d="M21 12a9 9 0 1 1-6.219-8.56" />
		</svg>
	</Button>
{/snippet}
