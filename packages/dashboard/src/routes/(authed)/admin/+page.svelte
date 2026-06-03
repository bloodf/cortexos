<script lang="ts">
	import type { PageData } from './$types';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import Settings from '$lib/icons/Settings.svelte';
	import { t } from '$lib/i18n';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();
</script>

<svelte:head>
	<title>{t(data.messages, 'app.nav.admin')} · CortexOS</title>
</svelte:head>

<div class="flex flex-col gap-6">
	<PageHeader
		title={t(data.messages, 'app.nav.admin')}
		description="Privileged surfaces land here. M1 ships the gate; tooling comes in M2."
		icon={Settings}
		breadcrumbs={[{ label: t(data.messages, 'app.nav.dashboard'), href: '/dashboard' }, { label: t(data.messages, 'app.nav.admin') }]}
	/>

	<EmptyState
		title="Admin tooling ships in M2"
		description="The (authed)/admin route group is wired and gated. Service catalog, user management, and the env browser land in M2."
		icon={Settings}
	/>
</div>
