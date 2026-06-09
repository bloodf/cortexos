<!--
  /incus — list page.

  Renders a search + filter bar, a DataTable of real Incus instances,
  and a right-sheet detail view with Overview / Config / Devices / Logs
  tabs. Instance names link to the existing /incus/[name] detail page.
-->
<script lang="ts">
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import type { PageData } from './$types';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import Server from '$lib/icons/Server.svelte';
	import { t } from '$lib/i18n';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import DataTable from '$lib/components/ui/data-table/DataTable.svelte';
	import type { Column, SortDir } from '$lib/components/ui/data-table/DataTable.types';
	import Sheet from '$lib/components/ui/sheet/Sheet.svelte';
	import SheetHeader from '$lib/components/ui/sheet/SheetHeader.svelte';
	import SheetTitle from '$lib/components/ui/sheet/SheetTitle.svelte';
	import SheetBody from '$lib/components/ui/sheet/SheetBody.svelte';
	import Tabs from '$lib/components/ui/tabs/Tabs.svelte';
	import TabsTrigger from '$lib/components/ui/tabs/TabsTrigger.svelte';
	import TabsContent from '$lib/components/ui/tabs/TabsContent.svelte';
	import Button from '$lib/components/ui/button/Button.svelte';
	import Badge from '$lib/components/ui/badge/Badge.svelte';
	import KeyValueList from '$lib/components/ui/key-value-list/KeyValueList.svelte';
	import CodeBlock from '$lib/components/ui/code-block/CodeBlock.svelte';
	import InstanceStateBadge from '$lib/components/incus/InstanceStateBadge.svelte';
	import InstanceSearch from '$lib/components/incus/InstanceSearch.svelte';
	import {
		countByStatus,
		filterByQuery,
		filterByStatus,
		filterByType,
		type StatusFilter,
		type TypeFilter,
		type IncusStatusLit,
		formatResources,
	} from '$lib/components/incus/adapter';
	import type { IncusInstance } from '@cortexos/contracts';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	const title = $derived(t(data.messages, 'incus.title'));
	const description = $derived(t(data.messages, 'incus.description'));
	const emptyDescription = $derived(t(data.messages, 'incus.empty'));
	const newLabel = $derived(t(data.messages, 'incus.new'));

	// svelte-ignore state_referenced_locally
	let activeQuery = $state<string>(data.q);
	// svelte-ignore state_referenced_locally
	let activeStatus = $state<StatusFilter>(data.status);
	// svelte-ignore state_referenced_locally
	let activeType = $state<TypeFilter>(data.type);

	let active = $state<IncusInstance | null>(null);
	let activeTab = $state('overview');
	let logs = $state<{ ts: string; priority: string; message: string }[]>([]);
	let logsLoading = $state(false);

	function pushFilters(): void {
		const params = new SvelteURLSearchParams(page.url.searchParams);
		if (activeQuery) params.set('q', activeQuery);
		else params.delete('q');
		if (activeStatus && activeStatus !== 'all') params.set('status', activeStatus);
		else params.delete('status');
		if (activeType && activeType !== 'all') params.set('type', activeType);
		else params.delete('type');
		const search = params.toString();
		void goto(`${page.url.pathname}${search ? '?' + search : ''}`, {
			replaceState: true,
			keepFocus: true,
			noScroll: true,
		});
	}

	function onQueryChange(next: string): void {
		activeQuery = next;
		pushFilters();
	}

	function onTypeChange(next: TypeFilter): void {
		activeType = next;
		pushFilters();
	}

	const visible: IncusInstance[] = $derived(
		filterByType(
			filterByStatus(filterByQuery(data.instances, activeQuery), activeStatus as StatusFilter),
			activeType,
		),
	);

	const counts = $derived(countByStatus(data.instances));

	// Show chips for all statuses that actually exist in the data,
	// sorted by a canonical order so the UI is stable.
	const STATUS_ORDER: IncusStatusLit[] = [
		'running',
		'active',
		'provisioning',
		'draft',
		'validated',
		'stopped',
		'frozen',
		'failed',
		'error',
	];
	const statusChips: IncusStatusLit[] = $derived(
		STATUS_ORDER.filter((s) => data.instances.some((i) => i.status === s)),
	);

	async function openSheet(row: Record<string, unknown>) {
		active = row as unknown as IncusInstance;
		activeTab = 'overview';
		logs = [];
		if (active && data.isAdmin) {
			logsLoading = true;
			try {
				const res = await fetch(`/api/incus/${encodeURIComponent(active.name)}/logs?limit=50`, { credentials: 'include' });
				if (res.ok) {
					const body = (await res.json()) as { lines?: { ts: string; priority: string; message: string }[] };
					logs = body.lines ?? [];
				}
			} finally {
				logsLoading = false;
			}
		}
	}

	async function dispatchAction(action: 'start' | 'stop' | 'restart', name: string) {
		try {
			const res = await fetch('/api/incus/actions', {
				method: 'POST',
				credentials: 'include',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ action, instance: name }),
			});
			const body = (await res.json().catch(() => ({}))) as { message?: string; status?: string };
			if (res.ok && body.status === 'accepted') {
				window.location.reload();
			} else {
				// eslint-disable-next-line no-alert
				window.alert(body.message ?? `Failed to ${action} ${name}`);
			}
		} catch {
			// eslint-disable-next-line no-alert
			window.alert(`Network error while trying to ${action} ${name}`);
		}
	}

	const columns: Column<Record<string, unknown>>[] = $derived([
		{
			key: 'name',
			header: t(data.messages, 'incus.table.name'),
			sortable: true,
			cell: nameCell,
		},
		{
			key: 'type',
			header: t(data.messages, 'incus.table.type'),
			sortable: true,
			cell: typeCell,
		},
		{ key: 'image', header: t(data.messages, 'incus.table.image'), sortable: true },
		{
			key: 'status',
			header: t(data.messages, 'incus.table.status'),
			sortable: true,
			cell: statusCell,
		},
		{
			key: 'cpu',
			header: t(data.messages, 'incus.table.cpu'),
			sortable: true,
			cell: cpuCell,
		},
		{
			key: 'memory',
			header: t(data.messages, 'incus.table.memory'),
			sortable: true,
			cell: memoryCell,
		},
	]);

	const initialSort: { key: string; dir: SortDir } = { key: 'name', dir: 'asc' };
</script>

{#snippet nameCell(row: Record<string, unknown>)}
	<a
		href="/incus/{row.name}"
		class="font-medium hover:underline truncate block text-xs font-mono"
		onclick={(e) => e.stopPropagation()}
	>
		{String(row.name ?? '')}
	</a>
{/snippet}

{#snippet typeCell(row: Record<string, unknown>)}
	<Badge variant="outline" size="sm">{String(row.type ?? '')}</Badge>
{/snippet}

{#snippet statusCell(row: Record<string, unknown>)}
	<InstanceStateBadge state={row.status as IncusStatusLit} size="sm" messages={data.messages} />
{/snippet}

{#snippet cpuCell(row: Record<string, unknown>)}
	<span class="text-right tabular-nums font-mono text-xs">
		{row.cpu != null ? `${row.cpu} vCPU` : '—'}
	</span>
{/snippet}

{#snippet memoryCell(row: Record<string, unknown>)}
	{@const r = formatResources(row as unknown as IncusInstance)}
	<span class="text-right tabular-nums font-mono text-xs">{r.memory}</span>
{/snippet}

<svelte:head>
	<title>{title} · CortexOS</title>
</svelte:head>

<div class="flex flex-col gap-6">
	<PageHeader {title} {description} icon={Server}>
		{#snippet actions()}
			{#if data.isAdmin}
				<a
					href="/incus/wizard"
					data-slot="incus-new"
					class="inline-flex h-8 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
				>
					{newLabel}
				</a>
			{/if}
		{/snippet}
	</PageHeader>

	<InstanceSearch
		messages={data.messages}
		query={activeQuery}
		type={activeType}
		onQueryChange={onQueryChange}
		onTypeChange={onTypeChange}
	/>

	<div
		data-slot="instance-status-filter"
		class="flex flex-wrap items-center gap-2"
		role="group"
		aria-label={t(data.messages, 'incus.filter.label')}
	>
		<button
			type="button"
			data-slot="instance-status-chip"
			data-status="all"
			class={activeStatus === 'all'
				? 'inline-flex h-7 items-center rounded-md border border-border bg-primary px-3 text-xs font-medium text-primary-foreground'
				: 'inline-flex h-7 items-center rounded-md border border-border bg-background px-3 text-xs font-medium hover:bg-accent'}
			aria-pressed={activeStatus === 'all'}
			onclick={() => {
				activeStatus = 'all';
				pushFilters();
			}}
		>
			{t(data.messages, 'incus.filter.all')} ({counts.total})
		</button>
		{#each statusChips as s (s)}
			<button
				type="button"
				data-slot="instance-status-chip"
				data-status={s}
				class={activeStatus === s
					? 'inline-flex h-7 items-center rounded-md border border-border bg-primary px-3 text-xs font-medium text-primary-foreground'
					: 'inline-flex h-7 items-center rounded-md border border-border bg-background px-3 text-xs font-medium hover:bg-accent'}
				aria-pressed={activeStatus === s}
				onclick={() => {
					activeStatus = s;
					pushFilters();
				}}
			>
				{t(data.messages, `incus.status.${s}`)}
			</button>
		{/each}
	</div>

	{#if visible.length === 0}
		<EmptyState {title} description={emptyDescription} icon={Server} />
	{:else}
		<DataTable
			columns={columns}
			data={visible as unknown as Record<string, unknown>[]}
			pageSize={25}
			{initialSort}
			onRowClick={openSheet}
		/>
	{/if}
</div>

<Sheet open={active !== null} side="right" onclose={() => (active = null)} class="w-full sm:max-w-xl">
	{#if active}
		<SheetHeader>
			<SheetTitle>{active.name}</SheetTitle>
			<p class="text-xs text-muted-foreground font-mono">{active.image}</p>
		</SheetHeader>
		<SheetBody>
			<Tabs value={activeTab} onchange={(v) => (activeTab = v)} class="w-full">
				<TabsTrigger value="overview" selected={activeTab}>Overview</TabsTrigger>
				<TabsTrigger value="config" selected={activeTab}>Config</TabsTrigger>
				<TabsTrigger value="devices" selected={activeTab}>Devices</TabsTrigger>
				<TabsTrigger value="logs" selected={activeTab}>Logs</TabsTrigger>
			</Tabs>

			<TabsContent value="overview" selected={activeTab}>
				<div class="space-y-4">
					{#if data.isAdmin}
						<div class="flex flex-wrap gap-2">
							{#if active.status === 'stopped' || active.status === 'error' || active.status === 'failed'}
								<Button size="sm" onclick={() => dispatchAction('start', active!.name)}>Start</Button>
							{:else}
								<Button size="sm" variant="outline" onclick={() => dispatchAction('restart', active!.name)}>Restart</Button>
								<Button size="sm" variant="outline" onclick={() => dispatchAction('stop', active!.name)}>Stop</Button>
							{/if}
						</div>
					{/if}
					<KeyValueList
						items={[
							{ key: 'Name', value: active.name },
							{ key: 'Slug', value: active.slug },
							{ key: 'Type', value: active.type },
							{ key: 'Image', value: active.image },
							{
								key: 'Status',
								value: t(data.messages, `incus.status.${active.status}`),
							},
							{ key: 'CPU', value: active.cpu != null ? `${active.cpu} vCPU` : '—' },
							{
								key: 'Memory',
								value: formatResources(active).memory,
							},
							{ key: 'Created', value: new Date(active.createdAt).toLocaleString() },
							{ key: 'Updated', value: new Date(active.updatedAt).toLocaleString() },
							{ key: 'Bridge', value: String(active.config?.network?.bridge ?? '—') },
							{ key: 'Pool', value: String(active.config?.image?.pool ?? '—') },
							{
								key: 'Tailscale',
								value: active.config?.network?.tailscale ? 'Enabled' : 'Disabled',
							},
							{
								key: 'Hermes',
								value: active.config?.hermes?.enabled ? 'Enabled' : 'Disabled',
							},
						]}
					/>
				</div>
			</TabsContent>

			<TabsContent value="config" selected={activeTab}>
				<CodeBlock
					code={JSON.stringify(active.config, null, 2)}
					language="json"
					maxHeight={480}
				/>
			</TabsContent>

			<TabsContent value="devices" selected={activeTab}>
				<CodeBlock
					code={JSON.stringify(active.devices, null, 2)}
					language="json"
					maxHeight={480}
				/>
			</TabsContent>

			<TabsContent value="logs" selected={activeTab}>
				{#if logsLoading}
					<p class="text-sm text-muted-foreground">Loading logs…</p>
				{:else if logs.length === 0}
					<p class="text-sm text-muted-foreground">{t(data.messages, 'incus.logs.empty')}</p>
				{:else}
					<div class="space-y-1">
						{#each logs as line (line.ts + line.message)}
							<div class="text-xs font-mono border-b border-border/50 pb-1">
								<span class="text-muted-foreground">{line.ts}</span>
								<span class="uppercase text-[10px] ml-2">[{line.priority}]</span>
								<span class="ml-2">{line.message}</span>
							</div>
						{/each}
					</div>
				{/if}
			</TabsContent>
		</SheetBody>
	{/if}
</Sheet>
