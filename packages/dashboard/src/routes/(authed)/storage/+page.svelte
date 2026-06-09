<script lang="ts">
	import type { PageData } from './$types';
	import type { Column } from '$lib/components/ui/data-table/DataTable.types';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import DataTable from '$lib/components/ui/data-table/DataTable.svelte';
	import HardDrive from '$lib/icons/HardDrive.svelte';
	import { t } from '$lib/i18n';
	import type { BlockDevice, ZfsPool } from './+page.server';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	const title = $derived(t(data.messages, 'app.nav.storage'));

	function parsePercent(pct: string): number {
		const n = parseInt(pct.replace('%', ''), 10);
		return isNaN(n) ? 0 : n;
	}

	function barColorClass(pct: number): string {
		if (pct >= 90) return 'bg-red-500';
		if (pct >= 75) return 'bg-yellow-500';
		return 'bg-green-500';
	}

	const blockColumns: Column<BlockDevice>[] = [
		{ key: 'name', header: 'Device', sortable: true },
		{ key: 'model', header: 'Model', sortable: true },
		{ key: 'type', header: 'Type', sortable: true },
		{ key: 'size', header: 'Size', sortable: true },
		{ key: 'mountpoint', header: 'Mount', sortable: true },
	];

	const zfsColumns: Column<ZfsPool>[] = [
		{ key: 'name', header: 'Pool', sortable: true },
		{ key: 'size', header: 'Size', sortable: true },
		{ key: 'allocated', header: 'Allocated', sortable: true },
		{ key: 'free', header: 'Free', sortable: true },
		{ key: 'capacity', header: 'Capacity', sortable: true },
		{ key: 'health', header: 'Health', sortable: true },
	];
</script>

<svelte:head>
	<title>{title} · CortexOS</title>
</svelte:head>

<div class="flex flex-col gap-6">
	<PageHeader
		{title}
		description="Mounts, ZFS pools, LVM volumes, and disk pressure."
		icon={HardDrive}
	/>

	{#if data.disks && data.disks.length > 0}
		<Card>
			{#snippet header()}
				<h2 class="text-base font-semibold">Disk Usage</h2>
			{/snippet}
			<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{#each data.disks as disk}
					{@const pct = parsePercent(disk.usePercent)}
					<div class="flex flex-col gap-2 rounded-md border p-3">
						<div class="flex items-center justify-between text-sm">
							<span class="font-mono text-xs">{disk.mount}</span>
							<span class="text-xs font-medium">{disk.usePercent}</span>
						</div>
						<div class="h-2 w-full overflow-hidden rounded-full bg-muted">
							<div
								class="h-full rounded-full transition-all {barColorClass(pct)}"
								style="width: {Math.min(pct, 100)}%"
							></div>
						</div>
						<div class="flex items-center justify-between text-xs text-muted-foreground">
							<span>{disk.used} / {disk.size}</span>
							<span>{disk.avail} free</span>
						</div>
					</div>
				{/each}
			</div>
			<div class="mt-4 overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b text-left text-muted-foreground">
							<th class="pb-2 pr-4">Filesystem</th>
							<th class="pb-2 pr-4">Size</th>
							<th class="pb-2 pr-4">Used</th>
							<th class="pb-2 pr-4">Available</th>
							<th class="pb-2 pr-4">Use%</th>
							<th class="pb-2">Mount</th>
						</tr>
					</thead>
					<tbody>
						{#each data.disks as disk}
							<tr class="border-b border-border/50">
								<td class="py-2 pr-4 font-mono text-xs">{disk.filesystem}</td>
								<td class="py-2 pr-4">{disk.size}</td>
								<td class="py-2 pr-4">{disk.used}</td>
								<td class="py-2 pr-4">{disk.avail}</td>
								<td class="py-2 pr-4">
									<span class="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium"
										class:bg-destructive={parseInt(disk.usePercent) >= 90}
										class:text-destructive-foreground={parseInt(disk.usePercent) >= 90}
										class:bg-muted={parseInt(disk.usePercent) < 90}
									>
										{disk.usePercent}
									</span>
								</td>
								<td class="py-2 font-mono text-xs">{disk.mount}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</Card>
	{/if}

	{#if data.blockDevices && data.blockDevices.length > 0}
		<Card>
			{#snippet header()}
				<h2 class="text-base font-semibold">Block Devices</h2>
			{/snippet}
			<DataTable columns={blockColumns} data={data.blockDevices} pageSize={10} />
		</Card>
	{/if}

	{#if data.zfsPools && data.zfsPools.length > 0}
		<Card>
			{#snippet header()}
				<h2 class="text-base font-semibold">ZFS Pools</h2>
			{/snippet}
			<DataTable columns={zfsColumns} data={data.zfsPools} pageSize={10} />
		</Card>
	{/if}

	{#if data.mounts && data.mounts.length > 0}
		<Card>
			{#snippet header()}
				<h2 class="text-base font-semibold">Mounts</h2>
			{/snippet}
			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b text-left text-muted-foreground">
							<th class="pb-2 pr-4">Target</th>
							<th class="pb-2 pr-4">Source</th>
							<th class="pb-2 pr-4">Type</th>
							<th class="pb-2">Options</th>
						</tr>
					</thead>
					<tbody>
						{#each data.mounts as mount}
							<tr class="border-b border-border/50">
								<td class="py-2 pr-4 font-mono text-xs">{mount.target}</td>
								<td class="py-2 pr-4 font-mono text-xs">{mount.source}</td>
								<td class="py-2 pr-4">{mount.fstype}</td>
								<td class="py-2 font-mono text-xs">{mount.options}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</Card>
	{/if}
</div>
