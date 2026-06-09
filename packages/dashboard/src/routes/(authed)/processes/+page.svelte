<script lang="ts">
	import type { PageData } from './$types';
	import type { ProcessInfo } from '$lib/types/dashboard';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import Progress from '$lib/components/ui/progress/Progress.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Input from '$lib/components/ui/input/Input.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Cpu from '$lib/icons/Cpu.svelte';
	import Menu from '$lib/icons/Menu.svelte';
	import Network from '$lib/icons/Network.svelte';
	import Search from '$lib/icons/Search.svelte';
	import { t } from '$lib/i18n';
	import TreeGroupItem from './TreeGroupItem.svelte';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	let processes = $state<ProcessInfo[]>([]);
	let loading = $state(true);
	let view = $state<'list' | 'tree'>('list');
	let q = $state('');
	let sortKey = $state<'pid' | 'user' | 'cpu' | 'mem' | 'command'>('cpu');
	let sortDir = $state<'asc' | 'desc'>('desc');

	async function fetchProcesses() {
		try {
			const res = await fetch('/api/processes', { credentials: 'include' });
			if (!res.ok) throw new Error('fetch failed');
			const payload = (await res.json()) as { processes: ProcessInfo[] };
			processes = payload.processes ?? [];
		} catch {
			// keep existing on error
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		void fetchProcesses();
		const id = setInterval(() => void fetchProcesses(), 3000);
		return () => clearInterval(id);
	});

	const title = $derived(t(data.messages, 'app.nav.processes'));

	const totalCpu = $derived(processes.reduce((s, p) => s + p.cpu, 0));
	const totalMem = $derived(processes.reduce((s, p) => s + p.mem, 0));

	function toggleSort(key: typeof sortKey) {
		if (sortKey === key) {
			sortDir = sortDir === 'asc' ? 'desc' : 'asc';
		} else {
			sortKey = key;
			sortDir = 'desc';
		}
	}

	const filtered = $derived.by(() => {
		const needle = q.trim().toLowerCase();
		if (!needle) return processes;
		return processes.filter(
			(p) =>
				p.command.toLowerCase().includes(needle) ||
				p.user.toLowerCase().includes(needle) ||
				String(p.pid).includes(needle),
		);
	});

	const sorted = $derived.by(() => {
		const cmp = (a: ProcessInfo, b: ProcessInfo) => {
			const av = a[sortKey];
			const bv = b[sortKey];
			if (typeof av === 'number' && typeof bv === 'number') return av - bv;
			return String(av).localeCompare(String(bv));
		};
		return [...filtered].sort((a, b) => {
			const r = cmp(a, b);
			return sortDir === 'asc' ? r : -r;
		});
	});

	const treeGroups = $derived.by(() => {
		const needle = q.trim().toLowerCase();
		const map = new Map<string, ProcessInfo[]>();
		for (const p of processes) {
			if (
				needle &&
				!(p.command.toLowerCase().includes(needle) || p.user.toLowerCase().includes(needle) || String(p.pid).includes(needle))
			)
				continue;
			const arr = map.get(p.user) ?? [];
			arr.push(p);
			map.set(p.user, arr);
		}
		return [...map.entries()]
			.map(([user, items]) => ({
				user,
				items: items.sort((a, b) => b.cpu - a.cpu),
				cpu: items.reduce((s, x) => s + x.cpu, 0),
				mem: items.reduce((s, x) => s + x.mem, 0),
			}))
			.sort((a, b) => b.cpu - a.cpu);
	});
</script>

<svelte:head>
	<title>{title} · CortexOS</title>
</svelte:head>

<div class="flex flex-col gap-5">
	<PageHeader
		{title}
		description="{processes.length} processes · CPU {totalCpu.toFixed(1)}% · MEM {totalMem.toFixed(1)}%"
		icon={Cpu}
	>
		{#snippet actions()}
			<div class="flex items-center gap-1 rounded-md border p-0.5 bg-muted/30">
				<Button
					size="sm"
					variant={view === 'list' ? 'default' : 'ghost'}
					onclick={() => (view = 'list')}
					class="h-7 px-2 text-xs gap-1.5"
				>
					<Menu class="size-3.5" /> List
				</Button>
				<Button
					size="sm"
					variant={view === 'tree' ? 'default' : 'ghost'}
					onclick={() => (view = 'tree')}
					class="h-7 px-2 text-xs gap-1.5"
				>
					<Network class="size-3.5" /> Tree
				</Button>
			</div>
		{/snippet}
	</PageHeader>

	{#if view === 'list'}
		<div class="flex flex-col gap-2">
			<div class="flex items-center gap-2">
				<div class="relative max-w-md flex-1">
					<Search class="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
					<Input
						type="search"
						value={q}
						oninput={(e) => (q = (e.currentTarget as HTMLInputElement).value)}
						placeholder="Filter by command, user or pid…"
						class="pl-8 h-9"
					/>
				</div>
				<span class="text-xs text-muted-foreground">{sorted.length} rows</span>
			</div>
			<div class="border rounded-md overflow-hidden">
				<table class="w-full caption-bottom text-sm">
					<thead class="bg-muted/40">
						<tr>
							{@render SortHead('pid', 'PID', 'w-20')}
							{@render SortHead('user', 'User')}
							{@render SortHead('command', 'Command')}
							{@render SortHead('cpu', 'CPU %', 'w-44')}
							{@render SortHead('mem', 'MEM %', 'w-44')}
						</tr>
					</thead>
					<tbody class="divide-y">
						{#if sorted.length === 0}
							<tr>
								<td colspan={5} class="text-center text-muted-foreground py-8">No results.</td>
							</tr>
						{:else}
							{#each sorted as p (p.pid)}
								<tr class="hover:bg-muted/30">
									<td class="px-3 py-2"><span class="font-mono tabular-nums">{p.pid}</span></td>
									<td class="px-3 py-2">{p.user}</td>
									<td class="px-3 py-2">
										<span class="font-mono text-xs truncate block max-w-[420px]" title={p.command}>{p.command}</span>
									</td>
									<td class="px-3 py-2">
										<div class="flex items-center gap-2 w-44">
											<Progress value={p.cpu} class="h-1.5 w-20" />
											<span class="tabular-nums text-xs">{p.cpu.toFixed(1)}</span>
										</div>
									</td>
									<td class="px-3 py-2">
										<div class="flex items-center gap-2 w-44">
											<Progress value={p.mem} class="h-1.5 w-20" />
											<span class="tabular-nums text-xs">{p.mem.toFixed(1)}</span>
										</div>
									</td>
								</tr>
							{/each}
						{/if}
					</tbody>
				</table>
			</div>
		</div>
	{:else}
		<div class="space-y-3">
			<div class="relative max-w-md">
				<Search class="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
				<Input
					type="search"
					value={q}
					oninput={(e) => (q = (e.currentTarget as HTMLInputElement).value)}
					placeholder="Filter by command, user or pid…"
					class="pl-8 h-9"
				/>
			</div>
			{#if treeGroups.length === 0}
				<Card>
					<EmptyState
						title="No processes match"
						description="Try clearing the filter."
						icon={Cpu}
					/>
				</Card>
			{:else}
				<div class="border rounded-md divide-y bg-card">
					{#each treeGroups as group (group.user)}
						{@render TreeGroup({group})}
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>

{#snippet SortHead(key: typeof sortKey, label: string, className = '')}
	<th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground {className}">
		<button type="button" class="inline-flex items-center gap-1 hover:text-foreground" onclick={() => toggleSort(key)}>
			{label}
			{#if sortKey === key}
				<span aria-hidden="true">{sortDir === 'asc' ? '↑' : '↓'}</span>
			{/if}
		</button>
	</th>
{/snippet}

{#snippet TreeGroup({ group }: { group: { user: string; items: ProcessInfo[]; cpu: number; mem: number } })}
	<TreeGroupItem {group} />
{/snippet}
