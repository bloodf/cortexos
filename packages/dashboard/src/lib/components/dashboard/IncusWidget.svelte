<script lang="ts">
	import MetricCard from '$lib/components/ui/metric-card/MetricCard.svelte';
	import Boxes from '$lib/icons/Boxes.svelte';
	import type { IncusInstance } from '$lib/types/dashboard';
	import type { Messages } from '$lib/i18n';
	import { t } from '$lib/i18n';

	interface Props {
		instances: IncusInstance[];
		messages: Messages;
	}

	let { instances, messages }: Props = $props();

	const active = $derived(instances.filter((i) => i.status === 'active').length);
</script>

<MetricCard
	label={t(messages, 'dashboard.widgets.incus')}
	value={`${active}/${instances.length}`}
	hint="instances active"
	icon={Boxes}
/>
