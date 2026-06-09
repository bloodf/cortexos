<script lang="ts">
	import type { PageData } from './$types';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Activity from '$lib/icons/Activity.svelte';
	import { t } from '$lib/i18n';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	const title = $derived(t(data.messages, 'app.nav.scheduler'));
</script>

<svelte:head>
	<title>{title} · CortexOS</title>
</svelte:head>

<div class="flex flex-col gap-6">
	<PageHeader
		{title}
		description="Cron jobs and one-shot timers managed by CortexOS."
		icon={Activity}
	/>

	{#if data.timers && data.timers.length > 0}
		<Card>
			{#snippet header()}
				<h2 class="text-base font-semibold">Systemd Timers</h2>
			{/snippet}
			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b text-left text-muted-foreground">
							<th class="pb-2 pr-4">Timer Unit</th>
							<th class="pb-2 pr-4">Next</th>
							<th class="pb-2 pr-4">Left</th>
							<th class="pb-2 pr-4">Last</th>
							<th class="pb-2">Activates</th>
						</tr>
					</thead>
					<tbody>
						{#each data.timers as timer}
							<tr class="border-b border-border/50">
								<td class="py-2 pr-4 font-mono text-xs">{timer.unit}</td>
								<td class="py-2 pr-4">{timer.next}</td>
								<td class="py-2 pr-4">{timer.left}</td>
								<td class="py-2 pr-4">{timer.last}</td>
								<td class="py-2 font-mono text-xs">{timer.activates}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</Card>
	{/if}

	{#if data.cronJobs && data.cronJobs.length > 0}
		<Card>
			{#snippet header()}
				<h2 class="text-base font-semibold">User Crontab</h2>
			{/snippet}
			<pre class="overflow-x-auto rounded bg-muted p-3 text-xs font-mono">
{#each data.cronJobs as job}{job.line}
{/each}</pre>
		</Card>
	{:else}
		<Card>
			{#snippet header()}
				<h2 class="text-base font-semibold">User Crontab</h2>
			{/snippet}
			<p class="text-sm text-muted-foreground">No crontab entries found.</p>
		</Card>
	{/if}
</div>
