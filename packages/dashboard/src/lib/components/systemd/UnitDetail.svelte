<!--
  UnitDetail — single-unit detail view.

  Composed of:
    1. Header — name, description, state badge, "enabled/disabled" tag.
    2. Fields — load state, sub state, unit path, critical flag.
    3. Action bar — start/stop/restart/reload/enable/disable.
    4. Logs — last N log lines (most recent first), rendered by
       `UnitLogs`.

  The component is presentational; data fetching lives in
  `+page.server.ts`. Action buttons POST through the form-action
  protocol (the page wraps UnitDetail in a <form>); the visible
  action bar dispatches via `onAction` for the page's JS-driven
  approval flow when the JS layer is loaded.

  i18n: every visible string routes through `t(messages, 'systemd.*')`.
-->
<script lang="ts">
	import type { SystemdUnit, SystemdLogLine } from '@cortexos/contracts';
	import { t, type Messages } from '$lib/i18n';
	import Card from '$lib/components/ui/card/Card.svelte';
	import CardHeader from '$lib/components/ui/card/CardHeader.svelte';
	import CardTitle from '$lib/components/ui/card/CardTitle.svelte';
	import CardDescription from '$lib/components/ui/card/CardDescription.svelte';
	import CardBody from '$lib/components/ui/card/CardBody.svelte';
	import Badge from '$lib/components/ui/badge/Badge.svelte';
	import UnitStateBadge from './UnitStateBadge.svelte';
	import UnitActionBar from './UnitActionBar.svelte';
	import UnitLogs from './UnitLogs.svelte';
	import { isRunning, type UnitActionKind } from './adapter';

	type Props = {
		/** The unit record. */
		unit: SystemdUnit;
		/** Recent log lines, newest first. May be empty. */
		logs: readonly SystemdLogLine[];
		/** Locale messages (from the root layout's PageData). */
		messages: Messages;
		/** True iff the current user is an admin (PB-5). */
		isAdmin: boolean;
		/** Click handler. The page wires the form-action protocol. */
		onAction?: (action: UnitActionKind) => void;
		/** Whether an action is currently in flight. */
		pending?: boolean;
		/** Optional className passthrough. */
		class?: string;
	};

	let {
		unit,
		logs,
		messages,
		isAdmin,
		onAction,
		pending = false,
		class: className,
	}: Props = $props();

	const title = $derived(unit.description || unit.name);

	const fieldName = $derived(t(messages, 'systemd.detail.fields.name'));
	const fieldDescription = $derived(t(messages, 'systemd.detail.fields.description'));
	const fieldLoad = $derived(t(messages, 'systemd.detail.fields.load'));
	const fieldSub = $derived(t(messages, 'systemd.detail.fields.sub'));
	const fieldEnabled = $derived(t(messages, 'systemd.detail.fields.enabled'));
	const fieldCritical = $derived(t(messages, 'systemd.detail.fields.critical'));
	const fieldAllowlisted = $derived(t(messages, 'systemd.detail.fields.allowlisted'));
	const fieldUnitPath = $derived(t(messages, 'systemd.detail.fields.unitPath'));
	const fieldType = $derived(t(messages, 'systemd.detail.fields.type'));

	const actionsTitle = $derived(t(messages, 'systemd.detail.actions'));
	const actionsDesc = $derived(t(messages, 'systemd.detail.actionsDescription'));
	const fieldsTitle = $derived(t(messages, 'systemd.detail.fields.title'));
	const fieldsDesc = $derived(t(messages, 'systemd.detail.fields.titleDescription'));

	const logsTitle = $derived(t(messages, 'systemd.detail.logs'));
	const logsDesc = $derived(t(messages, 'systemd.detail.logsDescription'));
	const logsEmpty = $derived(t(messages, 'systemd.detail.logsEmpty'));

	const canAct = $derived(isAdmin && unit.allowlisted);
	const running = $derived(isRunning(unit));
</script>

<div data-slot="unit-detail" class={`flex flex-col gap-6 ${className ?? ''}`}>
	<!-- Header -->
	<Card>
		<div class="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
			<div class="min-w-0 flex-1">
				<div class="flex flex-wrap items-center gap-2">
					<h1 class="text-xl font-semibold leading-tight" data-slot="unit-detail-title">
						{title}
					</h1>
					<UnitStateBadge {messages} state={unit.active} />
					<Badge variant="outline" size="sm">
						<span data-slot="unit-enabled-badge" data-enabled={String(unit.enabled)}>
							{unit.enabled
								? t(messages, 'systemd.status.enabled')
								: t(messages, 'systemd.status.disabled')}
						</span>
					</Badge>
				</div>
				<CardDescription>
					<span class="font-mono text-xs" data-slot="unit-detail-name">{unit.name}</span>
				</CardDescription>
			</div>
		</div>
	</Card>

	<!-- Action bar -->
	<Card>
		<CardHeader>
			<CardTitle>{actionsTitle}</CardTitle>
			<CardDescription>{actionsDesc}</CardDescription>
		</CardHeader>
		<CardBody>
			<UnitActionBar
				{messages}
				canAct={canAct}
				{onAction}
				{pending}
			/>
		</CardBody>
	</Card>

	<!-- Fields -->
	<Card>
		<CardHeader>
			<CardTitle>{fieldsTitle}</CardTitle>
			<CardDescription>{fieldsDesc}</CardDescription>
		</CardHeader>
		<CardBody>
			<dl class="grid grid-cols-1 gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
				<div class="flex flex-col gap-1">
					<dt class="text-xs uppercase tracking-wide text-muted-foreground">{fieldName}</dt>
					<dd class="font-mono text-xs" data-slot="unit-field-name">{unit.name}</dd>
				</div>
				<div class="flex flex-col gap-1">
					<dt class="text-xs uppercase tracking-wide text-muted-foreground">{fieldDescription}</dt>
					<dd data-slot="unit-field-description">{unit.description || '—'}</dd>
				</div>
				<div class="flex flex-col gap-1">
					<dt class="text-xs uppercase tracking-wide text-muted-foreground">{fieldLoad}</dt>
					<dd data-slot="unit-field-load">{unit.load}</dd>
				</div>
				<div class="flex flex-col gap-1">
					<dt class="text-xs uppercase tracking-wide text-muted-foreground">{fieldSub}</dt>
					<dd data-slot="unit-field-sub">{unit.sub || '—'}</dd>
				</div>
				<div class="flex flex-col gap-1">
					<dt class="text-xs uppercase tracking-wide text-muted-foreground">{fieldType}</dt>
					<dd data-slot="unit-field-type">{unit.type}</dd>
				</div>
				<div class="flex flex-col gap-1">
					<dt class="text-xs uppercase tracking-wide text-muted-foreground">{fieldEnabled}</dt>
					<dd data-slot="unit-field-enabled">{unit.enabled ? 'true' : 'false'}</dd>
				</div>
				<div class="flex flex-col gap-1">
					<dt class="text-xs uppercase tracking-wide text-muted-foreground">{fieldCritical}</dt>
					<dd data-slot="unit-field-critical">{unit.critical ? 'true' : 'false'}</dd>
				</div>
				<div class="flex flex-col gap-1">
					<dt class="text-xs uppercase tracking-wide text-muted-foreground">{fieldAllowlisted}</dt>
					<dd data-slot="unit-field-allowlisted">{unit.allowlisted ? 'true' : 'false'}</dd>
				</div>
				<div class="flex flex-col gap-1 sm:col-span-2">
					<dt class="text-xs uppercase tracking-wide text-muted-foreground">{fieldUnitPath}</dt>
					<dd class="break-all font-mono text-xs" data-slot="unit-field-unit-path">
						{unit.unitPath || '—'}
					</dd>
				</div>
			</dl>
		</CardBody>
	</Card>

	<!-- Logs -->
	<UnitLogs {messages} {logs} title={logsTitle} description={logsDesc} emptyLabel={logsEmpty} />
</div>
