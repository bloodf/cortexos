<script lang="ts">
	import MetricCard from '$lib/components/ui/metric-card/MetricCard.svelte';
	import Clock from '$lib/icons/Clock.svelte';
	import { duration } from '$lib/utils/format';
	import type { SystemData } from '$lib/types/dashboard';
	import type { Messages } from '$lib/i18n';
	import { t } from '$lib/i18n';

	interface Props {
		system: SystemData | null;
		messages: Messages;
	}

	let { system, messages }: Props = $props();
</script>

<MetricCard
	label={t(messages, 'dashboard.widgets.uptime')}
	value={duration(system?.uptime ?? 0)}
	icon={Clock}
/>
