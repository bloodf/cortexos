<!--
  AgentCard — rich card for a Hermes agent profile.
-->
<script lang="ts">
	import type { AgentItem } from './types';
	import Card from '$lib/components/ui/card/Card.svelte';
	import CardHeader from '$lib/components/ui/card/CardHeader.svelte';
	import CardTitle from '$lib/components/ui/card/CardTitle.svelte';
	import CardDescription from '$lib/components/ui/card/CardDescription.svelte';
	import CardBody from '$lib/components/ui/card/CardBody.svelte';
	import Button from '$lib/components/ui/button/Button.svelte';
	import Badge from '$lib/components/ui/badge/Badge.svelte';
	import AgentStateBadge from './AgentStateBadge.svelte';
	import Bot from '$lib/icons/Bot.svelte';
	import ExternalLink from '$lib/icons/ExternalLink.svelte';
	import FileText from '$lib/icons/FileText.svelte';
	import Pause from '$lib/icons/Pause.svelte';
	import PlayCircle from '$lib/icons/PlayCircle.svelte';
	import Power from '$lib/icons/Power.svelte';
	import RotateCw from '$lib/icons/RotateCw.svelte';
	import Activity from '$lib/icons/Activity.svelte';
	import AlertTriangle from '$lib/icons/AlertTriangle.svelte';
	import Tooltip from '$lib/components/ui/tooltip/Tooltip.svelte';

	type Props = {
		agent: AgentItem;
		isAdmin: boolean;
		onInspect: (a: AgentItem) => void;
		onAction: (a: AgentItem, action: 'start' | 'stop' | 'restart' | 'pause') => void;
	};

	let { agent, isAdmin, onInspect, onAction }: Props = $props();

	function formatUptime(sec: number): string {
		if (!sec || sec < 0) return '—';
		const d = Math.floor(sec / 86400);
		const h = Math.floor((sec % 86400) / 3600);
		const m = Math.floor((sec % 3600) / 60);
		if (d > 0) return `${d}d ${h}h`;
		if (h > 0) return `${h}h ${m}m`;
		return `${m}m`;
	}

	const healthVariant = {
		healthy: 'success' as const,
		degraded: 'warning' as const,
		down: 'destructive' as const,
	};

	const healthLabel = {
		healthy: 'Healthy',
		degraded: 'Degraded',
		down: 'Down',
	};
</script>

<Card class="elev-1 flex flex-col gap-3 group hover:border-primary/40 transition-colors">
	<CardHeader>
		<div class="flex items-start gap-3">
			<div class="relative shrink-0">
				<div class="size-10 rounded-md bg-primary/10 text-primary grid place-items-center">
					<Bot class="size-5" />
				</div>
				<div class="absolute -bottom-0.5 -right-0.5">
					<AgentStateBadge state={agent.state} />
				</div>
			</div>
			<div class="min-w-0 flex-1">
				<div class="flex items-center gap-2">
					<CardTitle class="truncate">{agent.name}</CardTitle>
					<span class="text-[10px] text-muted-foreground font-mono truncate">{agent.slug}</span>
				</div>
				<CardDescription class="line-clamp-2 mt-0.5">
					{agent.description || 'No description.'}
				</CardDescription>
			</div>
			<Badge variant={healthVariant[agent.health]} size="sm">{healthLabel[agent.health]}</Badge>
		</div>
	</CardHeader>

	<CardBody>
		<div class="grid grid-cols-2 gap-2 text-xs">
			<div class="min-w-0">
				<p class="text-[10px] uppercase tracking-wide text-muted-foreground">Model</p>
				<p class="font-mono truncate mt-0.5" title={agent.model}>{agent.model}</p>
			</div>
			<div class="min-w-0">
				<p class="text-[10px] uppercase tracking-wide text-muted-foreground">Provider</p>
				<p class="capitalize truncate mt-0.5">{agent.modelProvider}</p>
			</div>
			<div class="min-w-0">
				<p class="text-[10px] uppercase tracking-wide text-muted-foreground">Uptime</p>
				<p class="mt-0.5">{formatUptime(agent.uptimeSec)}</p>
			</div>
			<div class="min-w-0">
				<p class="text-[10px] uppercase tracking-wide text-muted-foreground">Queue</p>
				<p class="tabular-nums mt-0.5">{agent.queueDepth}</p>
			</div>
			<div class="min-w-0">
				<p class="text-[10px] uppercase tracking-wide text-muted-foreground">Req/min</p>
				<p class="tabular-nums mt-0.5">{agent.requestsPerMin}</p>
			</div>
			<div class="min-w-0">
				<p class="text-[10px] uppercase tracking-wide text-muted-foreground">Error rate</p>
				<p
					class="tabular-nums mt-0.5"
					class:text-destructive={agent.errorRatePct >= 5}
					class:text-warning={agent.errorRatePct >= 1 && agent.errorRatePct < 5}
				>
					{agent.errorRatePct.toFixed(1)}%
				</p>
			</div>
		</div>
	</CardBody>

	<div class="px-4 pb-4">
		<div class="flex items-center justify-between gap-2 text-[11px] text-muted-foreground mb-3">
			<span class="inline-flex items-center gap-1.5">
				<Activity class="size-3" /> p95 {agent.p95LatencyMs}ms
			</span>
			<span>v{agent.version} · {agent.lastActivity ? new Date(agent.lastActivity).toLocaleString() : '—'}</span>
		</div>

		<div class="flex items-center gap-1 pt-2 border-t">
			<Button size="sm" variant="ghost" class="h-7 text-xs" href={agent.hermesUrl} target="_blank" rel="noreferrer">
				<ExternalLink class="size-3.5 mr-1" /> Hermes UI
			</Button>
			<Button size="sm" variant="ghost" class="h-7 text-xs" onclick={() => onInspect(agent)}>
				<FileText class="size-3.5 mr-1" /> Inspect
			</Button>
			<div class="flex-1"></div>
			{#if isAdmin}
				{#if agent.state === 'running' || agent.state === 'idle'}
					<Tooltip text="Restart">
						{#snippet trigger()}
							<Button
								size="icon"
								variant="outline"
								class="size-7"
								aria-label="Restart"
								disabled={!isAdmin}
								onclick={() => onAction(agent, 'restart')}
							>
								<RotateCw class="size-3.5" />
							</Button>
						{/snippet}
					</Tooltip>
					<Tooltip text="Pause">
						{#snippet trigger()}
							<Button
								size="icon"
								variant="outline"
								class="size-7"
								aria-label="Pause"
								disabled={!isAdmin}
								onclick={() => onAction(agent, 'pause')}
							>
								<Pause class="size-3.5" />
							</Button>
						{/snippet}
					</Tooltip>
					<Tooltip text="Stop">
						{#snippet trigger()}
							<Button
								size="icon"
								variant="outline"
								class="size-7"
								aria-label="Stop"
								disabled={!isAdmin}
								onclick={() => onAction(agent, 'stop')}
							>
								<Power class="size-3.5" />
							</Button>
						{/snippet}
					</Tooltip>
				{:else}
					<Tooltip text="Start">
						{#snippet trigger()}
							<Button
								size="icon"
								variant="outline"
								class="size-7"
								aria-label="Start"
								disabled={!isAdmin}
								onclick={() => onAction(agent, 'start')}
							>
								<PlayCircle class="size-3.5" />
							</Button>
						{/snippet}
					</Tooltip>
				{/if}
			{/if}
		</div>

		{#if agent.state === 'error'}
			<div
				class="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-1.5 text-[11px] text-destructive mt-2"
			>
				<AlertTriangle class="size-3.5 mt-0.5 shrink-0" />
				<span>Agent crashed — check <a href="/audit" class="underline">audit log</a> for details.</span>
			</div>
		{/if}
	</div>
</Card>
