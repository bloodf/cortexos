<!--
  /audit/[id] — single audit event detail with prev/next links and
  chain verification badge.
-->
<script lang="ts">
	import type { PageData } from './$types';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import AuditEventDetail from '$lib/components/audit/AuditEventDetail.svelte';
	import ScrollText from '$lib/icons/ScrollText.svelte';
	import { t } from '$lib/i18n';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	const title = $derived(t(data.messages, 'app.nav.audit'));
</script>

<svelte:head>
	<title>{title} · CortexOS</title>
</svelte:head>

<div class="flex flex-col gap-6">
	<PageHeader
		{title}
		description={`Event ${data.event.id}`}
		icon={ScrollText}
		breadcrumbs={[
			{ label: t(data.messages, 'app.nav.dashboard'), href: '/dashboard' },
			{ label: title, href: '/audit' },
			{ label: data.event.id.slice(0, 8) },
		]}
	/>
	<AuditEventDetail
		event={data.event}
		prevId={data.prevId}
		nextId={data.nextId}
		chainLink={data.chainLink}
		messages={data.messages}
	/>
</div>
