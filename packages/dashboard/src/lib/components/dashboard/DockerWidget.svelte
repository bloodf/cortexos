<script lang="ts">
	import MetricCard from '$lib/components/ui/metric-card/MetricCard.svelte';
	import Container from '$lib/icons/Container.svelte';
	import type { DockerContainer } from '$lib/types/dashboard';
	import type { Messages } from '$lib/i18n';
	import { t } from '$lib/i18n';

	interface Props {
		containers: DockerContainer[];
		messages: Messages;
	}

	let { containers, messages }: Props = $props();

	const running = $derived(containers.filter((c) => c.state === 'running').length);
</script>

<MetricCard
	label={t(messages, 'dashboard.widgets.docker')}
	value={`${running}/${containers.length}`}
	hint="containers running"
	icon={Container}
/>
