<!--
  IncidentTimeline — vertical timeline of alert-history events.

  Consumes the joined alert_history + alert_rules + services shape returned
  by the healthcheck server load. Coloured dots reflect event status.
-->
<script lang="ts" module>
	export type AlertHistoryItem = {
		id: number | string;
		ruleName: string;
		serviceName: string;
		status: string;
		message: string;
		timestamp: string;
	};
</script>

<script lang="ts">
	import { cn } from '$lib/utils/cn';

	type Props = {
		alerts: AlertHistoryItem[];
		class?: string;
	};

	let { alerts, class: className = '' }: Props = $props();

	function dotColor(status: string): string {
		switch (status) {
			case 'fired':
				return 'bg-destructive';
			case 'resolved':
				return 'bg-success';
			default:
				return 'bg-primary';
		}
	}

	function relativeTime(iso: string): string {
		const t = new Date(iso).getTime();
		const diff = (Date.now() - t) / 1000;
		if (!isFinite(diff) || diff < 0) return iso;
		if (diff < 5) return 'just now';
		if (diff < 60) return `${Math.floor(diff)}s ago`;
		if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
		if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
		return `${Math.floor(diff / 86400)}d ago`;
	}
</script>

{#if alerts.length === 0}
	<p class="text-sm text-muted-foreground">No recent incidents.</p>
{:else}
	<ol class={cn('relative ml-2 border-l pl-4 space-y-3', className)}>
		{#each alerts.slice(0, 12) as a (a.id)}
			<li class="relative">
				<span
					class={cn(
						'absolute -left-1.5 top-1.5 size-3 rounded-full ring-4 ring-background',
						dotColor(a.status)
					)}
					aria-hidden="true"
				></span>
				<div class="flex flex-wrap items-baseline gap-2 text-sm">
					<span class="font-medium">{a.ruleName}</span>
					<span class="text-xs text-muted-foreground">{a.serviceName}</span>
					<span class="ml-auto text-xs text-muted-foreground">{relativeTime(a.timestamp)}</span>
				</div>
				<p class="text-xs text-muted-foreground">{a.message}</p>
			</li>
		{/each}
	</ol>
{/if}
