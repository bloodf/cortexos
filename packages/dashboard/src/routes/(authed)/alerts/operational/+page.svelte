<!--
  /alerts/operational — operational alert list.
  Filterable by severity and acknowledged state.
-->
<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import { t } from '$lib/i18n';
	import { OperationalAlertList } from '$lib/components/alerts';
	import AlertTriangle from '$lib/icons/AlertTriangle.svelte';
	import type { OperationalAlert } from '@cortexos/contracts';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();
	const title = $derived(t(data.messages, 'alerts.operational.title'));
	const description = $derived(t(data.messages, 'alerts.operational.description'));

	function navigate(next: { severity?: string | null; status?: string | null }) {
		const params = new URLSearchParams(page.url.searchParams);
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

	function selectOperational(alert: OperationalAlert) {
		void goto(`/alerts/operational/${encodeURIComponent(alert.id)}`);
	}
</script>

<svelte:head>
	<title>{title} · CortexOS</title>
</svelte:head>

<div class="flex flex-col gap-6">
	<PageHeader {title} {description} icon={AlertTriangle} />

	<div class="flex flex-wrap items-center gap-2 text-sm">
		<label for="op-severity">Severity:</label>
		<select
			id="op-severity"
			data-slot="op-severity-filter"
			value={data.filters.severity ?? ''}
			onchange={(e) => navigate({ severity: (e.currentTarget as HTMLSelectElement).value || null })}
			class="border-input bg-background rounded-md border px-2 py-1 text-sm"
		>
			<option value="">{t(data.messages, 'alerts.operational.all')}</option>
			<option value="info">{t(data.messages, 'alerts.severity.info')}</option>
			<option value="warning">{t(data.messages, 'alerts.severity.warning')}</option>
			<option value="critical">{t(data.messages, 'alerts.severity.critical')}</option>
		</select>

		<label for="op-ack">Status:</label>
		<select
			id="op-ack"
			data-slot="op-ack-filter"
			value={data.filters.ackStatus}
			onchange={(e) => navigate({ status: (e.currentTarget as HTMLSelectElement).value })}
			class="border-input bg-background rounded-md border px-2 py-1 text-sm"
		>
			<option value="all">{t(data.messages, 'alerts.operational.all')}</option>
			<option value="unacknowledged">{t(data.messages, 'alerts.operational.unack')}</option>
			<option value="acknowledged">Acknowledged</option>
		</select>
	</div>

	<OperationalAlertList
		alerts={data.operational}
		messages={data.messages}
		onSelect={selectOperational}
	/>
</div>
