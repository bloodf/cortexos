<script lang="ts">
	import MetricCard from '$lib/components/ui/metric-card/MetricCard.svelte';
	import Thermometer from '$lib/icons/Thermometer.svelte';
	import { tempColor } from '$lib/utils/status';
	import type { SystemData } from '$lib/types/dashboard';
	import type { Messages } from '$lib/i18n';
	import { t } from '$lib/i18n';

	interface Props {
		system: SystemData | null;
		messages: Messages;
	}

	let { system, messages }: Props = $props();

	const tval = $derived(system?.sensors.cpuTemperature?.value ?? 0);
	const labelText = $derived(system?.sensors.cpuTemperature?.label);
</script>

{#snippet valueSnippet()}
	<span class={tempColor(tval)}>{tval.toFixed(1)}°C</span>
{/snippet}

<MetricCard
	label={t(messages, 'dashboard.widgets.cpuTemp')}
	value={valueSnippet}
	hint={labelText}
	icon={Thermometer}
/>
