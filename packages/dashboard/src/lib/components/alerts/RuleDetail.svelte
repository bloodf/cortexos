<!--
  RuleDetail — read-only view of a single alert rule with the
  enable / disable form action. The form posts to the page's
  default action (the same `/alerts/rules/[id]` route), and the
  page-level `actions.enable` / `actions.disable` handler
  performs the mutation.

  The component is a presentation shell: the page supplies the
  action target URL via `formAction` (defaults to the current
  page). Disabled state is the local `submitting` flag toggled
  during the in-flight request.

  i18n: every visible string routes through `t(messages, 'alerts.*')`.
-->
<script lang="ts">
	import type { AlertRule } from '@cortexos/contracts';
	import { t, type Messages } from '$lib/i18n';
	import Card from '$lib/components/ui/card/Card.svelte';
	import CardHeader from '$lib/components/ui/card/CardHeader.svelte';
	import CardTitle from '$lib/components/ui/card/CardTitle.svelte';
	import CardDescription from '$lib/components/ui/card/CardDescription.svelte';
	import CardBody from '$lib/components/ui/card/CardBody.svelte';
	import Button from '$lib/components/ui/button/Button.svelte';
	import AlertSeverityBadge from './AlertSeverityBadge.svelte';

	type Props = {
		rule: AlertRule;
		messages: Messages;
		/** True when the current user can toggle the rule (admin). */
		canToggle?: boolean;
		/** Form action URL. Defaults to the current page. */
		formAction?: string;
		/** True when a form submission is in flight. */
		submitting?: boolean;
		/** Optional className passthrough. */
		class?: string;
	};

	let {
		rule,
		messages,
		canToggle = false,
		formAction = '',
		submitting = false,
		class: className,
	}: Props = $props();

	const conditionLabel = $derived.by(() => {
		switch (rule.condition) {
			case 'offline':
				return t(messages, 'alerts.rules.form.conditionOffline');
			case 'online':
				return t(messages, 'alerts.rules.form.conditionOnline');
			case 'response_time':
				return t(messages, 'alerts.rules.form.conditionResponseTime');
		}
	});

	const thresholdLabel = $derived(
		rule.thresholdMs != null ? `${rule.thresholdMs}ms` : null,
	);

	const toggleLabel = $derived(
		rule.enabled
			? t(messages, 'alerts.actions.disable')
			: t(messages, 'alerts.actions.enable'),
	);
	const toggleConfirm = $derived(
		rule.enabled
			? t(messages, 'alerts.rules.detail.disableConfirm')
			: t(messages, 'alerts.rules.detail.enableConfirm'),
	);
	const toggleAction = $derived(rule.enabled ? 'disable' : 'enable');
</script>

<Card size="default" class={className}>
	<CardHeader>
		<div class="flex items-start justify-between gap-3">
			<div class="min-w-0 flex-1">
				<CardTitle>{rule.name}</CardTitle>
				<CardDescription>{t(messages, 'alerts.rules.detail.description')}</CardDescription>
			</div>
			<AlertSeverityBadge severity={rule.severity} {messages} size="sm" />
		</div>
	</CardHeader>
	<CardBody>
		<dl class="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
			<dt class="font-medium text-muted-foreground">
				{t(messages, 'alerts.rules.detail.condition')}
			</dt>
			<dd data-slot="rule-detail-condition">{conditionLabel}</dd>

			{#if thresholdLabel}
				<dt class="font-medium text-muted-foreground">
					{t(messages, 'alerts.rules.detail.threshold')}
				</dt>
				<dd data-slot="rule-detail-threshold">{thresholdLabel}</dd>
			{/if}

			<dt class="font-medium text-muted-foreground">
				{t(messages, 'alerts.rules.detail.enabled')}
			</dt>
			<dd data-slot="rule-detail-enabled" data-enabled={rule.enabled}>
				{rule.enabled ? '✓' : '—'}
			</dd>

			<dt class="font-medium text-muted-foreground">
				{t(messages, 'alerts.rules.detail.created')}
			</dt>
			<dd data-slot="rule-detail-created">{rule.createdAt}</dd>

			<dt class="font-medium text-muted-foreground">
				{t(messages, 'alerts.rules.detail.updated')}
			</dt>
			<dd data-slot="rule-detail-updated">{rule.updatedAt}</dd>
		</dl>
	</CardBody>

	{#if canToggle}
		<div class="border-t px-6 py-4">
			<form
				method="POST"
				action={formAction || undefined}
				onsubmit={(e: Event) => {
					if (!confirm(toggleConfirm)) e.preventDefault();
				}}
				data-slot="rule-toggle"
				data-action={toggleAction}
			>
				<input type="hidden" name="action" value={toggleAction} />
				<Button
					type="submit"
					variant={rule.enabled ? 'destructive' : 'default'}
					disabled={submitting}
				>
					{submitting ? `${toggleLabel}…` : toggleLabel}
				</Button>
			</form>
		</div>
	{/if}
</Card>
