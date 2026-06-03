<!--
  /alerts/rules/[id] — rule detail page.
  Renders the rule metadata and the rule's recent firings, with
  an enable / disable form (admin only).
-->
<script lang="ts">
	import type { PageData } from './$types';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import { t } from '$lib/i18n';
	import { RuleDetail, AlertHistoryTimeline } from '$lib/components/alerts';
	import AlertTriangle from '$lib/icons/AlertTriangle.svelte';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();
	const title = $derived(t(data.messages, 'alerts.rules.detail.title'));
</script>

<svelte:head>
	<title>{title} · CortexOS</title>
</svelte:head>

<div class="flex flex-col gap-6">
	<div class="flex items-center gap-2 text-sm">
		<a href="/alerts" class="text-muted-foreground underline-offset-2 hover:underline">
			← {t(data.messages, 'alerts.actions.back')}
		</a>
	</div>

	<PageHeader {title} icon={AlertTriangle} />

	<RuleDetail rule={data.rule} messages={data.messages} canToggle={data.canToggle} />

	<section class="flex flex-col gap-2">
		<h2 class="text-base font-semibold">
			{t(data.messages, 'alerts.rules.detail.history')}
		</h2>
		<AlertHistoryTimeline
			events={data.history}
			messages={data.messages}
			emptyMessage={t(data.messages, 'alerts.rules.detail.historyEmpty')}
		/>
	</section>
</div>
