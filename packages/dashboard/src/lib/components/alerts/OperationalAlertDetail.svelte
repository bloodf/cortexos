<!--
  OperationalAlertDetail — read-only view of a single operational
  alert with the acknowledge form action.

  The acknowledge button posts to the page's default action with
  a hidden `action=acknowledge` field; the page action handler
  performs the mutation. Only renders the form when the alert is
  unacknowledged.

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
	import Button from '$lib/components/ui/button/Button.svelte';
	import AlertSeverityBadge from './AlertSeverityBadge.svelte';

	type Props = {
		alert: OperationalAlert;
		messages: Messages;
		/** True when the current user can ack (any authed user). */
		canAck?: boolean;
		/** Form action URL. Defaults to the current page. */
		formAction?: string;
		/** True when a form submission is in flight. */
		submitting?: boolean;
		class?: string;
	};

	let {
		alert,
		messages,
		canAck = true,
		formAction = '',
		submitting = false,
		class: className,
	}: Props = $props();

	const ackLabel = $derived(
		submitting ? `${t(messages, 'alerts.actions.acknowledge')}…` : t(messages, 'alerts.actions.acknowledge'),
	);
	const confirmText = $derived(t(messages, 'alerts.operational.detail.acknowledgeConfirm'));
	const ackedText = $derived(
		alert.acknowledged && alert.acknowledgedAt
			? `${t(messages, 'alerts.operational.detail.acknowledgedAt')}: ${alert.acknowledgedAt}`
			: t(messages, 'alerts.operational.detail.notAcknowledged'),
	);
</script>

<Card size="default" class={className}>
	<CardHeader>
		<div class="flex items-start justify-between gap-3">
			<div class="min-w-0 flex-1">
				<CardTitle>{alert.title}</CardTitle>
				<CardDescription>
					<span data-slot="operational-alert-detail-source">{alert.source}</span>
				</CardDescription>
			</div>
			<AlertSeverityBadge severity={alert.severity} {messages} size="sm" />
		</div>
	</CardHeader>
	<CardBody>
		<dl class="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
			<dt class="font-medium text-muted-foreground">
				{t(messages, 'alerts.operational.detail.body')}
			</dt>
			<dd data-slot="operational-alert-detail-body">{alert.message}</dd>

			<dt class="font-medium text-muted-foreground">
				{t(messages, 'alerts.operational.detail.severity')}
			</dt>
			<dd data-slot="operational-alert-detail-severity">{alert.severity}</dd>

			<dt class="font-medium text-muted-foreground">
				{t(messages, 'alerts.operational.detail.created')}
			</dt>
			<dd data-slot="operational-alert-detail-created">{alert.createdAt}</dd>
		</dl>
	</CardBody>
	<CardFooter>
		<div class="flex w-full items-center justify-between gap-2">
			<span
				data-slot="operational-alert-detail-acked"
				data-acknowledged={alert.acknowledged}
				class="text-muted-foreground text-xs"
			>
				{ackedText}
			</span>
			{#if canAck && !alert.acknowledged}
				<form
					method="POST"
					action={formAction || undefined}
					onsubmit={(e: Event) => {
						if (!confirm(confirmText)) e.preventDefault();
					}}
					data-slot="operational-alert-ack"
				>
					<input type="hidden" name="action" value="acknowledge" />
					<Button type="submit" disabled={submitting}>
						{ackLabel}
					</Button>
				</form>
			{/if}
		</div>
	</CardFooter>
</Card>
