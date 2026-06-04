<!--
  AlertHistoryTimeline — vertical timeline of rule firings.

  Used by:
    - the /alerts/history route (one big timeline, all rules)
    - the /alerts/rules/[id] page (the rule's own firings)

  Each row surfaces the firing time, rule name (when present),
  service name (when present), status, and the message.

  i18n: every visible string routes through `t(messages, 'alerts.*')`.
-->
<script lang="ts">
	import type { AlertEvent } from '@cortexos/contracts';
	import { t, type Messages } from '$lib/i18n';
	import EmptyState from '$lib/components/ui/empty-state/EmptyState.svelte';
	import History from '$lib/icons/ScrollText.svelte';

	type Props = {
		events: readonly AlertEvent[];
		messages: Messages;
		/** Optional empty-state message override. */
		emptyMessage?: string;
		class?: string;
	};

	let { events, messages, emptyMessage, class: className }: Props = $props();

	function statusLabel(s: AlertEvent['status']): string {
		switch (s) {
			case 'fired':
				return t(messages, 'alerts.history.event.fired');
			case 'resolved':
				return t(messages, 'alerts.history.event.resolved');
			case 'info':
				return t(messages, 'alerts.history.event.info');
		}
	}
</script>

{#if events.length === 0}
	<EmptyState title={emptyMessage ?? t(messages, 'alerts.history.empty')} class={className}>
		{#snippet icon()}
			<History />
		{/snippet}
	</EmptyState>
{:else}
	<ol
		data-slot="alert-history-timeline"
		class={['flex flex-col gap-2', className].filter(Boolean).join(' ')}
	>
		{#each events as event (event.id)}
			<li
				data-slot="alert-history-row"
				data-event-id={event.id}
				data-status={event.status}
				class="border-border bg-card text-card-foreground flex flex-col gap-1 rounded-md border px-4 py-3"
			>
				<div class="flex items-center justify-between gap-3">
					<span class="text-xs font-medium" data-slot="alert-history-status">
						{statusLabel(event.status)}
					</span>
					<span class="text-muted-foreground text-xs" data-slot="alert-history-time">
						{event.firedAt}
					</span>
				</div>
				<div class="flex flex-wrap items-baseline gap-2 text-sm">
					{#if event.ruleName}
						<span class="font-medium" data-slot="alert-history-rule-name">
							{event.ruleName}
						</span>
					{/if}
					{#if event.serviceName}
						<span class="text-muted-foreground text-xs" data-slot="alert-history-service-name">
							· {event.serviceName}
						</span>
					{/if}
				</div>
				<p class="text-sm" data-slot="alert-history-message">{event.message}</p>
			</li>
		{/each}
	</ol>
{/if}
