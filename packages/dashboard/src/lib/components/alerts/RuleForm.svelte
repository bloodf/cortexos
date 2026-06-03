<!--
  RuleForm — create/edit form for an alert rule.

  Bound to a SvelteKit form action. Hidden `action` field
  carries the form verb (`create` for new, `update` for edit).
  Required-field validation is enforced server-side; the
  client-side `required` attributes are belt-and-suspenders.

  i18n: every visible label routes through `t(messages, 'alerts.*')`.
-->
<script lang="ts">
	import type { AlertRule, AlertCondition, AlertChannel, AlertSeverity } from '@cortexos/contracts';
	import { t, type Messages } from '$lib/i18n';
	import Button from '$lib/components/ui/button/Button.svelte';
	import Input from '$lib/components/ui/input/Input.svelte';
	import Label from '$lib/components/ui/label/Label.svelte';

	type Props = {
		messages: Messages;
		/** Optional existing rule — when set, the form posts an `update`. */
		rule?: AlertRule;
		/** Form action URL. Defaults to the current page. */
		formAction?: string;
		/** True when a form submission is in flight. */
		submitting?: boolean;
		/** Optional className passthrough. */
		class?: string;
	};

	let {
		messages,
		rule,
		formAction = '',
		submitting = false,
		class: className,
	}: Props = $props();

	// Local form state — initialized from the rule prop (edit) or
	// the defaults below (create). The hidden `action` field
	// carries the form verb the page action handler reads.
	// svelte-ignore state_referenced_locally -- intentional: rule is the initial value
	let name = $state(rule?.name ?? '');
	// svelte-ignore state_referenced_locally
	let condition = $state<AlertCondition>(rule?.condition ?? 'offline');
	// svelte-ignore state_referenced_locally
	let thresholdMs = $state<string>(
		rule?.thresholdMs != null ? String(rule.thresholdMs) : '',
	);
	// svelte-ignore state_referenced_locally
	let severity = $state<AlertSeverity>(rule?.severity ?? 'warning');
	// svelte-ignore state_referenced_locally
	let enabled = $state<boolean>(rule?.enabled ?? true);
	// svelte-ignore state_referenced_locally
	let channels = $state<AlertChannel[]>(rule?.channels ?? ['ui']);
	// svelte-ignore state_referenced_locally
	let serviceId = $state<string>(rule?.serviceId ?? '');

	// `rule` is the initial value; the form fields are independent
	// from this point on. Svelte's reactivity tracks state changes,
	// not prop changes, so editing the `rule` prop does not refresh
	// the form fields — that's intentional.
	// svelte-ignore state_referenced_locally
	const isEdit = !!rule;
	const formVerb = isEdit ? 'update' : 'create';
	const submitLabel = $derived(
		submitting ? t(messages, 'alerts.actions.saving') : t(messages, 'alerts.actions.save'),
	);

	function toggleChannel(ch: AlertChannel): void {
		if (channels.includes(ch)) {
			channels = channels.filter((c) => c !== ch);
		} else {
			channels = [...channels, ch];
		}
	}

	const channelLabels: Record<AlertChannel, string> = {
		ui: 'alerts.rules.form.channelUi',
		email: 'alerts.rules.form.channelEmail',
		webhook: 'alerts.rules.form.channelWebhook',
		log: 'alerts.rules.form.channelLog',
	};
</script>

<form
	method="POST"
	action={formAction || undefined}
	class={['flex flex-col gap-4', className].filter(Boolean).join(' ')}
	data-slot="rule-form"
	data-form-verb={formVerb}
>
	<input type="hidden" name="action" value={formVerb} />

	<div class="flex flex-col gap-1.5">
		<Label for="rule-name">{t(messages, 'alerts.rules.form.name')}</Label>
		<Input
			id="rule-name"
			name="name"
			required
			bind:value={name}
			placeholder={t(messages, 'alerts.rules.form.namePlaceholder')}
		/>
	</div>

	<div class="flex flex-col gap-1.5">
		<Label for="rule-service-id">{t(messages, 'alerts.rules.form.serviceId')}</Label>
		<Input
			id="rule-service-id"
			name="serviceId"
			type="text"
			bind:value={serviceId}
			placeholder={t(messages, 'alerts.rules.form.serviceIdPlaceholder')}
		/>
	</div>

	<div class="flex flex-col gap-1.5">
		<Label for="rule-condition">{t(messages, 'alerts.rules.form.condition')}</Label>
		<select
			id="rule-condition"
			name="condition"
			required
			bind:value={condition}
			class="border-input bg-background rounded-md border px-3 py-2 text-sm"
		>
			<option value="offline">{t(messages, 'alerts.rules.form.conditionOffline')}</option>
			<option value="online">{t(messages, 'alerts.rules.form.conditionOnline')}</option>
			<option value="response_time">
				{t(messages, 'alerts.rules.form.conditionResponseTime')}
			</option>
		</select>
	</div>

	{#if condition === 'response_time'}
		<div class="flex flex-col gap-1.5">
			<Label for="rule-threshold">{t(messages, 'alerts.rules.form.thresholdMs')}</Label>
			<!-- Raw <input> — the design-system Input wrapper doesn't
			     support number min/max; the server re-validates. -->
			<input
				id="rule-threshold"
				name="thresholdMs"
				type="number"
				min="1"
				max="600000"
				required
				bind:value={thresholdMs}
				placeholder={t(messages, 'alerts.rules.form.thresholdMsPlaceholder')}
				class="border-input bg-background flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
			/>
		</div>
	{/if}

	<div class="flex flex-col gap-1.5">
		<Label for="rule-severity">{t(messages, 'alerts.rules.form.severity')}</Label>
		<select
			id="rule-severity"
			name="severity"
			required
			bind:value={severity}
			class="border-input bg-background rounded-md border px-3 py-2 text-sm"
		>
			<option value="info">{t(messages, 'alerts.severity.info')}</option>
			<option value="warning">{t(messages, 'alerts.severity.warning')}</option>
			<option value="critical">{t(messages, 'alerts.severity.critical')}</option>
		</select>
	</div>

	<fieldset class="flex flex-col gap-2">
		<legend class="text-sm font-medium">
			{t(messages, 'alerts.rules.form.channels')}
		</legend>
		<div class="flex flex-wrap gap-3">
			{#each (['ui', 'email', 'webhook', 'log'] as const) as ch (ch)}
				<label class="flex items-center gap-2 text-sm">
					<input
						type="checkbox"
						name="channels"
						value={ch}
						checked={channels.includes(ch)}
						onchange={() => toggleChannel(ch)}
					/>
					{t(messages, channelLabels[ch])}
				</label>
			{/each}
		</div>
	</fieldset>

	<label class="flex items-center gap-2 text-sm">
		<input type="checkbox" name="enabled" bind:checked={enabled} />
		{t(messages, 'alerts.rules.form.enabled')}
	</label>

	<div class="flex items-center gap-2">
		<Button type="submit" disabled={submitting}>
			{submitLabel}
		</Button>
		<a
			href="/alerts"
			class="text-muted-foreground text-sm underline-offset-2 hover:underline"
		>
			{t(messages, 'alerts.actions.cancel')}
		</a>
	</div>
</form>
