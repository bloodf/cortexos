<!--
  /alerts/rules/new — create form (admin only).
-->
<script lang="ts">
	import type { PageData } from './$types';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import { t } from '$lib/i18n';
	import { RuleForm } from '$lib/components/alerts';
	import AlertTriangle from '$lib/icons/AlertTriangle.svelte';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();
	const title = $derived(t(data.messages, 'alerts.rules.new'));
	const description = $derived(t(data.messages, 'alerts.rules.newDescription'));
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

	<PageHeader {title} {description} icon={AlertTriangle} />

	<RuleForm messages={data.messages} />
</div>
