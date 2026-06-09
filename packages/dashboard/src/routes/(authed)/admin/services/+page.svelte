<script lang="ts">
	import type { PageData } from './$types';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import PlugZap from '$lib/icons/PlugZap.svelte';
	import { t } from '$lib/i18n';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	const title = 'Services';
	const description = 'Admin view of the full services catalog (including inactive).';
	const emptyTitle = 'No services found';
	const emptyDescription = 'The services catalog is empty.';
</script>

<svelte:head>
	<title>{title} · Admin · CortexOS</title>
</svelte:head>

<div class="flex flex-col gap-6">
	<PageHeader {title} {description} icon={PlugZap} />

	{#if data.services.length === 0}
		<EmptyState title={emptyTitle} description={emptyDescription} icon={PlugZap} />
	{:else}
		<div class="overflow-x-auto rounded-md border border-border">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-border bg-muted/50 text-left">
						<th class="px-3 py-2 font-medium">Slug</th>
						<th class="px-3 py-2 font-medium">Name</th>
						<th class="px-3 py-2 font-medium">Kind</th>
						<th class="px-3 py-2 font-medium">Category</th>
						<th class="px-3 py-2 font-medium">Status</th>
						<th class="px-3 py-2 font-medium">Active</th>
						<th class="px-3 py-2 font-medium">Web UI</th>
					</tr>
				</thead>
				<tbody>
					{#each data.services as svc (svc.id)}
						<tr class="border-b border-border/60 hover:bg-muted/40">
							<td class="px-3 py-2 font-mono text-xs">{svc.slug}</td>
							<td class="px-3 py-2 text-xs">{svc.name}</td>
							<td class="px-3 py-2 text-xs">{svc.kind}</td>
							<td class="px-3 py-2 text-xs">{svc.category}</td>
							<td class="px-3 py-2 text-xs">
								<span class={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
									svc.status === 'online'
										? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
										: svc.status === 'offline'
											? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
											: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
								}`}>
									{svc.status}
								</span>
							</td>
							<td class="px-3 py-2 text-xs">{svc.isActive ? 'Yes' : 'No'}</td>
							<td class="px-3 py-2 text-xs">{svc.hasWebui ? 'Yes' : 'No'}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
