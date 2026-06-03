<!--
  /services/[id] — single-service detail page.

  Renders the `ServiceDetail` component with the loaded data. The
  "Recheck now" button submits the form action defined in
  `+page.server.ts` and updates the history table with the new
  snapshot returned by the action.

  i18n: the `data.messages` map flows from the root layout and is
  passed straight through to ServiceDetail.
-->
<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import ServiceDetail from '$lib/components/services/ServiceDetail.svelte';
	import { t } from '$lib/i18n';
	import type { ServiceHealthSnapshot } from '@cortexos/contracts';

	interface Props {
		data: PageData;
		form: ActionData;
	}

	let { data, form }: Props = $props();

	// History: server-loaded snapshots, plus any snapshot returned
	// by the most recent recheck form action. Newest first.
	const history: ServiceHealthSnapshot[] = $derived.by(() => {
		const seeded = form?.snapshot ? [form.snapshot] : [];
		return [...seeded, ...data.history];
	});

	let rechecking = $state(false);

	function handleRecheck(): void {
		rechecking = true;
		// The form action is bound to the surrounding <form> below;
		// submitting via the form element keeps the progressive
		// enhancement story intact (works without JS too).
		const formEl = document.getElementById('recheck-form') as HTMLFormElement | null;
		formEl?.requestSubmit();
		// We don't know when the response returns; reset the flag
		// on a generous timer. Real implementation can hook into
		// use:enhance's `then` callback.
		setTimeout(() => {
			rechecking = false;
		}, 800);
	}

	const title = $derived(t(data.messages, 'app.nav.services'));
</script>

<svelte:head>
	<title>{data.service.name} · {title} · CortexOS</title>
</svelte:head>

<form
	id="recheck-form"
	method="POST"
	action="?/recheck"
	data-slot="recheck-form"
	class="contents"
>
	<ServiceDetail
		messages={data.messages}
		service={data.service}
		{history}
		onRecheck={handleRecheck}
		{rechecking}
	/>
</form>
