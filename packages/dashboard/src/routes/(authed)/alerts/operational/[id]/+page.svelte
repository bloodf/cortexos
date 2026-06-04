<!--
  /alerts/operational/[id] — operational alert detail with ack.
-->
<script lang="ts">
	import type { PageData } from './$types';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import { t } from '$lib/i18n';
	import { OperationalAlertDetail } from '$lib/components/alerts';
	import AlertTriangle from '$lib/icons/AlertTriangle.svelte';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();
	const title = $derived(t(data.messages, 'alerts.operational.detail.title'));
</script>

<svelte:head>
	<title>{title} · CortexOS</title>
</svelte:head>

<div class="flex flex-col gap-6">
	<div class="flex items-center gap-2 text-sm">
		<a
			href="/alerts/operational"
			class="text-muted-foreground underline-offset-2 hover:underline"
		>
			← {t(data.messages, 'alerts.actions.back')}
		</a>
	</div>

	<PageHeader {title} icon={AlertTriangle} />

	<OperationalAlertDetail alert={data.alert} messages={data.messages} canAck={true} />
</div>
