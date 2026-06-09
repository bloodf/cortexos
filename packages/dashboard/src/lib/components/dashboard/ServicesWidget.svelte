<script lang="ts">
	import MetricCard from '$lib/components/ui/metric-card/MetricCard.svelte';
	import Activity from '$lib/icons/Activity.svelte';
	import type { Service } from '$lib/server/entities';
	import type { Messages } from '$lib/i18n';
	import { t } from '$lib/i18n';

	interface Props {
		services: Service[];
		messages: Messages;
	}

	let { services, messages }: Props = $props();

	const on = $derived(services.filter((s) => s.status === 'online').length);
	const off = $derived(services.filter((s) => s.status === 'offline').length);
	const unk = $derived(services.filter((s) => s.status === 'unknown').length);
	const bad = $derived(off + unk);
</script>

<MetricCard
	label={t(messages, 'dashboard.widgets.services')}
	value={`${on}/${services.length}`}
	hint={bad > 0 ? `${bad} offline` : 'all online'}
	icon={Activity}
/>
