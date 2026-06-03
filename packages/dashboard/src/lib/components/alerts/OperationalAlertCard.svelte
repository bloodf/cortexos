<!--
  OperationalAlertCard — single operational alert row.

  Used inside the operational list. Color-coded via the
  AlertSeverityBadge. Acknowledged alerts are visually muted
  (the whole card's data-acknowledged attribute is `true`).

  i18n: every visible string routes through `t(messages, 'alerts.*')`.
-->
<script lang="ts">
	import type { OperationalAlert } from '@cortexos/contracts';
	import { t, type Messages } from '$lib/i18n';
	import Card from '$lib/components/ui/card/Card.svelte';
	import CardHeader from '$lib/components/ui/card/CardHeader.svelte';
	import CardTitle from '$lib/components/ui/card/CardTitle.svelte';
	import CardDescription from '$lib/components/ui/card/CardDescription.svelte';
	import CardBody from '$lib/components/ui/card/CardBody.svelte';
	import CardFooter from '$lib/components/ui/card/CardFooter.svelte';
	import AlertSeverityBadge from './AlertSeverityBadge.svelte';

	type Props = {
		alert: OperationalAlert;
		messages: Messages;
		onSelect?: (alert: OperationalAlert) => void;
		class?: string;
	};

	let { alert, messages, onSelect, class: className }: Props = $props();

	const ariaSeverity = $derived(t(messages, 'alerts.operational.detail.severity'));
	const ackedLabel = $derived(
		alert.acknowledged
			? t(messages, 'alerts.operational.detail.acknowledgedAt')
			: t(messages, 'alerts.operational.detail.notAcknowledged'),
	);

	function handleClick(): void {
		if (onSelect) onSelect(alert);
	}

	function handleKey(event: KeyboardEvent): void {
		if (!onSelect) return;
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			onSelect(alert);
		}
	}
</script>

<Card size="default" class={className}>
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<div
		role={onSelect ? 'button' : undefined}
		tabindex={onSelect ? 0 : undefined}
		data-slot="operational-alert-card"
		data-alert-id={alert.id}
		data-severity={alert.severity}
		data-acknowledged={alert.acknowledged}
		onclick={handleClick}
		onkeydown={handleKey}
		class="flex h-full cursor-pointer flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
	>
		<CardHeader>
			<div class="flex items-start justify-between gap-3">
				<div class="min-w-0 flex-1">
					<CardTitle>{alert.title}</CardTitle>
					<CardDescription>
						<span data-slot="operational-alert-source">{alert.source}</span>
					</CardDescription>
				</div>
				<AlertSeverityBadge severity={alert.severity} {messages} size="sm" />
			</div>
		</CardHeader>
		<CardBody>
			<p class="text-muted-foreground line-clamp-3 text-sm" data-slot="operational-alert-body">
				{alert.message}
			</p>
		</CardBody>
		<CardFooter>
			<div class="flex w-full items-center justify-between gap-2 text-xs">
				<span data-slot="operational-alert-acked" class="text-muted-foreground">
					{ackedLabel}
				</span>
				<span data-slot="operational-alert-severity" class="sr-only">
					{ariaSeverity}: {alert.severity}
				</span>
			</div>
		</CardFooter>
	</div>
</Card>
