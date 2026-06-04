<!--
  RuleCard — single rule row in the alert-rules list.

  The card is non-interactive on its own; navigation is provided
  via the optional `onSelect` handler. The card surfaces the
  rule's name, condition (with threshold where relevant), and
  the enabled switch (read-only here; mutations go through the
  detail page form action).

  i18n: every visible string routes through `t(messages, 'alerts.*')`.

  Accessibility:
    - `data-slot="rule-card"` is the test/CSS hook.
    - `data-rule-id` exposes the canonical id.
    - The whole card is keyboard-activatable when `onSelect` is set.
-->
<script lang="ts">
	import type { AlertRule } from '@cortexos/contracts';
	import { t, type Messages } from '$lib/i18n';
	import Card from '$lib/components/ui/card/Card.svelte';
	import CardHeader from '$lib/components/ui/card/CardHeader.svelte';
	import CardTitle from '$lib/components/ui/card/CardTitle.svelte';
	import CardDescription from '$lib/components/ui/card/CardDescription.svelte';
	import CardBody from '$lib/components/ui/card/CardBody.svelte';
	import CardFooter from '$lib/components/ui/card/CardFooter.svelte';
	import Switch from '$lib/components/ui/switch/Switch.svelte';
	import AlertSeverityBadge from './AlertSeverityBadge.svelte';

	/**
	 * Structural input — every field the card needs. We accept
	 * either a contracts `AlertRule` or the same shape with the
	 * raw DB integer id (so the route loader can pass either).
	 */
	type Props = {
		/** The full rule record. */
		rule: AlertRule;
		/** Optional click handler — e.g. `navigate('/alerts/rules/${id}')`. */
		onSelect?: (rule: AlertRule) => void;
		/** Locale messages (from the root layout's PageData). */
		messages: Messages;
		/** Optional className passthrough for layout grids. */
		class?: string;
	};

	let { rule, onSelect, messages, class: className }: Props = $props();

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

	const ariaEnabled = $derived(t(messages, 'alerts.rules.detail.enabled'));

	function handleClick(): void {
		if (onSelect) onSelect(rule);
	}

	function handleKey(event: KeyboardEvent): void {
		if (!onSelect) return;
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			onSelect(rule);
		}
	}
</script>

<Card size="default" class={className}>
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<div
		role={onSelect ? 'button' : undefined}
		tabindex={onSelect ? 0 : undefined}
		data-slot="rule-card"
		data-rule-id={rule.id}
		data-enabled={rule.enabled}
		onclick={handleClick}
		onkeydown={handleKey}
		class="flex h-full cursor-pointer flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
	>
		<CardHeader>
			<div class="flex items-start justify-between gap-3">
				<div class="min-w-0 flex-1">
					<CardTitle>{rule.name}</CardTitle>
					<CardDescription>
						<span data-slot="rule-condition">{conditionLabel}</span>
						{#if thresholdLabel}
							<span data-slot="rule-threshold" class="ml-1">· {thresholdLabel}</span>
						{/if}
					</CardDescription>
				</div>
				<AlertSeverityBadge
					severity={rule.severity}
					{messages}
					size="sm"
				/>
			</div>
		</CardHeader>
		<CardBody>
			<dl class="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
				<dt class="font-medium">{t(messages, 'alerts.rules.detail.condition')}</dt>
				<dd data-slot="rule-condition-dl">{conditionLabel}</dd>
				{#if thresholdLabel}
					<dt class="font-medium">{t(messages, 'alerts.rules.detail.threshold')}</dt>
					<dd data-slot="rule-threshold-dl">{thresholdLabel}</dd>
				{/if}
			</dl>
		</CardBody>
		<CardFooter>
			<div class="flex w-full items-center justify-between gap-2">
				<span class="text-xs text-muted-foreground">{ariaEnabled}</span>
				<span data-slot="rule-enabled-state">
					<!-- Display-only switch: the real toggle lives on the
					     detail page (form action). The card is a
					     navigation surface, not a mutation surface. -->
					<Switch checked={rule.enabled} disabled aria-label={ariaEnabled} />
				</span>
			</div>
		</CardFooter>
	</div>
</Card>
