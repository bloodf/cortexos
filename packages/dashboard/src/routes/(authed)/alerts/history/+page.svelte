<!--
  /alerts/history — alert event history with filters.
-->
<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import { t } from '$lib/i18n';
	import { AlertHistoryTimeline } from '$lib/components/alerts';
	import Input from '$lib/components/ui/input/Input.svelte';
	import Label from '$lib/components/ui/label/Label.svelte';
	import History from '$lib/icons/ScrollText.svelte';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();
	const title = $derived(t(data.messages, 'alerts.history.title'));
	const description = $derived(t(data.messages, 'alerts.history.description'));

	function navigate(next: { ruleId?: string; serviceId?: string }) {
		const params = new URLSearchParams(page.url.searchParams);
		if (next.ruleId !== undefined) {
			if (next.ruleId) params.set('ruleId', next.ruleId);
			else params.delete('ruleId');
		}
		if (next.serviceId !== undefined) {
			if (next.serviceId) params.set('serviceId', next.serviceId);
			else params.delete('serviceId');
		}
		const qs = params.toString();
		void goto(`${page.url.pathname}${qs ? '?' + qs : ''}`, {
			replaceState: true,
			keepFocus: true,
			noScroll: true,
		});
	}
</script>

<svelte:head>
	<title>{title} · CortexOS</title>
</svelte:head>

<div class="flex flex-col gap-6">
	<PageHeader {title} {description} icon={History} />

	<div class="flex flex-wrap items-end gap-3">
		<div class="flex flex-col gap-1.5">
			<Label for="history-rule">{t(data.messages, 'alerts.history.filter.rule')}</Label>
			<Input
				id="history-rule"
				name="ruleId"
				type="text"
				value={data.filters.ruleId ? String(data.filters.ruleId) : ''}
				placeholder={t(data.messages, 'alerts.history.filter.rulePlaceholder')}
				onchange={(e) =>
					navigate({ ruleId: (e.currentTarget as HTMLInputElement).value })}
				class="w-40"
			/>
		</div>
		<div class="flex flex-col gap-1.5">
			<Label for="history-service">{t(data.messages, 'alerts.history.filter.service')}</Label>
			<Input
				id="history-service"
				name="serviceId"
				type="text"
				value={data.filters.serviceId ? String(data.filters.serviceId) : ''}
				placeholder={t(data.messages, 'alerts.history.filter.servicePlaceholder')}
				onchange={(e) =>
					navigate({ serviceId: (e.currentTarget as HTMLInputElement).value })}
				class="w-40"
			/>
		</div>
	</div>

	<AlertHistoryTimeline
		events={data.events}
		messages={data.messages}
		emptyMessage={t(data.messages, 'alerts.history.empty')}
	/>
</div>
