<!--
  /alerts — index page with three tabs:
    - Rules (rule-based alerts)
    - Operational (live feed)
    - History (rule firings, newest first)

  Filters: ?severity (operational tab), ?status (rules: enabled |
  disabled | all; operational: acknowledged | unacknowledged | all).
  The page pushes filter changes into the URL via `goto`, so the
  filter survives page reloads and can be shared.

  i18n: every visible string routes through `t(data.messages, 'alerts.*')`.
-->
<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import { t, type Messages } from '$lib/i18n';
	import {
		RuleList,
		OperationalAlertList,
		AlertHistoryTimeline,
	} from '$lib/components/alerts';
	import AlertTriangle from '$lib/icons/AlertTriangle.svelte';
	import type { AlertRule, OperationalAlert, AlertSeverity, AlertEvent } from '@cortexos/contracts';

	interface Props {
		data: PageData & {
			rules: AlertRule[];
			operational: OperationalAlert[];
			history: AlertEvent[];
			filters: { severity: AlertSeverity | null; ruleStatus: 'all' | 'enabled' | 'disabled'; ackStatus: 'all' | 'unacknowledged' | 'acknowledged' };
			canManageRules: boolean;
			messages: Messages;
		};
	}

	let { data }: Props = $props();

	const title = $derived(t(data.messages, 'alerts.title'));
	const description = $derived(t(data.messages, 'alerts.description'));

	type Tab = 'rules' | 'operational' | 'history';
	let activeTab = $state<Tab>('rules');

	function navigateToFilter(next: { tab?: Tab; severity?: AlertSeverity | null; status?: string | null }) {
		const params = new URLSearchParams(page.url.searchParams);
		if (next.tab) {
			// tab is implicit in the path / the URL; we don't push it
			// as a query param to keep the URL clean.
			void params;
		}
		if (next.severity !== undefined) {
			if (next.severity) params.set('severity', next.severity);
			else params.delete('severity');
		}
		if (next.status !== undefined) {
			if (next.status) params.set('status', next.status);
			else params.delete('status');
		}
		const qs = params.toString();
		void goto(`${page.url.pathname}${qs ? '?' + qs : ''}`, {
			replaceState: true,
			keepFocus: true,
			noScroll: true,
		});
	}

	function selectRule(rule: AlertRule) {
		// The synthesized UUID isn't a valid `[id]` route param —
		// navigate by the underlying integer. We don't have a clean
		// id-on-the-rule back-channel, so fall back to the rule name.
		void goto(`/alerts/rules/${encodeURIComponent(rule.id)}`);
	}

	function selectOperational(alert: OperationalAlert) {
		void goto(`/alerts/operational/${encodeURIComponent(alert.id)}`);
	}
</script>

<svelte:head>
	<title>{title} · CortexOS</title>
</svelte:head>

<div class="flex flex-col gap-6">
	<PageHeader {title} {description} icon={AlertTriangle} />

	<div role="tablist" class="border-border flex gap-1 border-b" data-slot="alerts-tabs">
		<button
			role="tab"
			aria-selected={activeTab === 'rules'}
			data-slot="tab-rules"
			data-active={activeTab === 'rules'}
			class="border-b-2 px-4 py-2 text-sm font-medium transition-colors"
			class:border-primary={activeTab === 'rules'}
			class:text-foreground={activeTab === 'rules'}
			class:border-transparent={activeTab !== 'rules'}
			class:text-muted-foreground={activeTab !== 'rules'}
			onclick={() => (activeTab = 'rules')}
		>
			{t(data.messages, 'alerts.tabs.rules')}
		</button>
		<button
			role="tab"
			aria-selected={activeTab === 'operational'}
			data-slot="tab-operational"
			data-active={activeTab === 'operational'}
			class="border-b-2 px-4 py-2 text-sm font-medium transition-colors"
			class:border-primary={activeTab === 'operational'}
			class:text-foreground={activeTab === 'operational'}
			class:border-transparent={activeTab !== 'operational'}
			class:text-muted-foreground={activeTab !== 'operational'}
			onclick={() => (activeTab = 'operational')}
		>
			{t(data.messages, 'alerts.tabs.operational')}
		</button>
		<button
			role="tab"
			aria-selected={activeTab === 'history'}
			data-slot="tab-history"
			data-active={activeTab === 'history'}
			class="border-b-2 px-4 py-2 text-sm font-medium transition-colors"
			class:border-primary={activeTab === 'history'}
			class:text-foreground={activeTab === 'history'}
			class:border-transparent={activeTab !== 'history'}
			class:text-muted-foreground={activeTab !== 'history'}
			onclick={() => (activeTab = 'history')}
		>
			{t(data.messages, 'alerts.tabs.history')}
		</button>
	</div>

	{#if activeTab === 'rules'}
		<div class="flex items-center gap-2 text-sm">
			<label for="rule-status-filter">Status:</label>
			<select
				id="rule-status-filter"
				data-slot="rule-status-filter"
				value={data.filters.ruleStatus}
				onchange={(e) =>
					navigateToFilter({ status: (e.currentTarget as HTMLSelectElement).value })}
				class="border-input bg-background rounded-md border px-2 py-1 text-sm"
			>
				<option value="all">All</option>
				<option value="enabled">Enabled</option>
				<option value="disabled">Disabled</option>
			</select>
			{#if data.canManageRules}
				<a
					href="/alerts/rules/new"
					data-slot="new-rule-cta"
					class="ml-auto rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
				>
					{t(data.messages, 'alerts.actions.create')}
				</a>
			{/if}
		</div>
		<RuleList rules={data.rules} messages={data.messages} onSelect={selectRule} />
	{:else if activeTab === 'operational'}
		<div class="flex flex-wrap items-center gap-2 text-sm">
			<label for="op-severity-filter">Severity:</label>
			<select
				id="op-severity-filter"
				data-slot="op-severity-filter"
				value={data.filters.severity ?? ''}
				onchange={(e) =>
					navigateToFilter({
						severity: ((e.currentTarget as HTMLSelectElement).value || null) as
							| AlertSeverity
							| null,
					})}
				class="border-input bg-background rounded-md border px-2 py-1 text-sm"
			>
				<option value="">All</option>
				<option value="info">Info</option>
				<option value="warning">Warning</option>
				<option value="critical">Critical</option>
			</select>
			<label for="op-ack-filter">Ack:</label>
			<select
				id="op-ack-filter"
				data-slot="op-ack-filter"
				value={data.filters.ackStatus}
				onchange={(e) =>
					navigateToFilter({ status: (e.currentTarget as HTMLSelectElement).value })}
				class="border-input bg-background rounded-md border px-2 py-1 text-sm"
			>
				<option value="all">All</option>
				<option value="unacknowledged">Unacknowledged</option>
				<option value="acknowledged">Acknowledged</option>
			</select>
		</div>
		<OperationalAlertList
			alerts={data.operational}
			messages={data.messages}
			onSelect={selectOperational}
		/>
	{:else}
		<AlertHistoryTimeline
			events={data.history}
			messages={data.messages}
			emptyMessage={t(data.messages, 'alerts.history.empty')}
		/>
	{/if}
</div>
