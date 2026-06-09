<script lang="ts">
	import type { PageData } from './$types';
	import type { AgentItem, AgentRunState } from './+page.server';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import Input from '$lib/components/ui/input/Input.svelte';
	import AgentCard from '$lib/components/agents/AgentCard.svelte';
	import AgentInspectDialog from '$lib/components/agents/AgentInspectDialog.svelte';
	import Bot from '$lib/icons/Bot.svelte';
	import Search from '$lib/icons/Search.svelte';
	import { t } from '$lib/i18n';
	import { useToaster } from '$lib/components/ui/toast/Toast.svelte';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	let q = $state('');
	let stateFilter = $state<'all' | AgentRunState>('all');
	let inspectAgent = $state<AgentItem | null>(null);

	const agents = $derived(data.agents);

	const filtered = $derived.by(() => {
		const needle = q.trim().toLowerCase();
		return agents.filter((a) => {
			if (stateFilter !== 'all' && a.state !== stateFilter) return false;
			if (!needle) return true;
			return [a.name, a.slug, a.model, a.description].some((x) =>
				x.toLowerCase().includes(needle),
			);
		});
	});

	const counts = $derived.by(() => ({
		all: agents.length,
		running: agents.filter((a) => a.state === 'running').length,
		idle: agents.filter((a) => a.state === 'idle').length,
		stopped: agents.filter((a) => a.state === 'stopped').length,
		error: agents.filter((a) => a.state === 'error').length,
	}));

	const stateChips: Array<'all' | AgentRunState> = ['all', 'running', 'idle', 'stopped', 'error'];

	const toaster = useToaster();

	function handleAction(agent: AgentItem, action: 'start' | 'stop' | 'restart' | 'pause') {
		if (!data.isAdmin) {
			toaster.push({
				title: 'Admin only',
				description: 'You need admin role to control agents.',
				variant: 'warning',
			});
			return;
		}
		toaster.push({
			title: `${action.charAt(0).toUpperCase() + action.slice(1)} queued`,
			description: `${agent.name} (${agent.slug})`,
			variant: 'success',
		});
	}
</script>

<svelte:head>
	<title>{t(data.messages, 'agents.title')} · CortexOS</title>
</svelte:head>

<div class="flex flex-col gap-6">
	<PageHeader
		title={t(data.messages, 'agents.title')}
		description={t(data.messages, 'agents.description')}
		icon={Bot}
	/>

	<div class="flex flex-wrap items-center gap-3">
		<div class="relative flex-1 min-w-[220px] max-w-md">
			<Search class="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
			<Input
				type="search"
				value={q}
				oninput={(e) => (q = (e.currentTarget as HTMLInputElement).value)}
				placeholder={t(data.messages, 'agents.search.placeholder')}
				class="pl-8 h-9"
			/>
		</div>
		<div class="flex items-center gap-1 ml-auto flex-wrap">
			{#each stateChips as s (s)}
				{@const c = counts}
				<button
					type="button"
					class={stateFilter === s
						? 'inline-flex h-8 items-center rounded-md border px-2.5 text-xs capitalize transition-colors bg-accent text-accent-foreground border-accent'
						: 'inline-flex h-8 items-center rounded-md border px-2.5 text-xs capitalize transition-colors hover:bg-muted/50'}
					onclick={() => (stateFilter = s)}
				>
					{t(data.messages, `agents.state.${s}`)}
					<span class="text-muted-foreground ml-1 tabular-nums">{s === 'all' ? c.all : c[s]}</span>
				</button>
			{/each}
		</div>
	</div>

	{#if filtered.length === 0}
		<EmptyState
			title={t(data.messages, 'agents.empty.title')}
			description={agents.length === 0
				? t(data.messages, 'agents.empty.descriptionNoProfiles')
				: t(data.messages, 'agents.empty.descriptionNoMatch')}
			icon={Bot}
		/>
	{:else}
		<div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
			{#each filtered as agent (agent.slug)}
				<AgentCard
					{agent}
					isAdmin={data.isAdmin}
					onInspect={(a) => (inspectAgent = a)}
					onAction={handleAction}
				/>
			{/each}
		</div>
	{/if}
</div>

<AgentInspectDialog agent={inspectAgent} onClose={() => (inspectAgent = null)} />
