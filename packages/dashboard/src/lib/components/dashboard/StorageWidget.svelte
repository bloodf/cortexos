<script lang="ts">
	import MetricCard from '$lib/components/ui/metric-card/MetricCard.svelte';
	import Progress from '$lib/components/ui/progress/Progress.svelte';
	import HardDrive from '$lib/icons/HardDrive.svelte';
	import { percent, bytes } from '$lib/utils/format';
	import type { SystemData } from '$lib/types/dashboard';
	import type { Messages } from '$lib/i18n';
	import { t } from '$lib/i18n';

	interface Props {
		system: SystemData | null;
		messages: Messages;
	}

	let { system, messages }: Props = $props();

	const total = $derived(system?.drives.reduce((a, d) => a + (d.total ?? d.size), 0) ?? 0);
	const used = $derived(system?.drives.reduce((a, d) => a + (d.used ?? 0), 0) ?? 0);
	const pct = $derived(total ? (used / total) * 100 : 0);
</script>

<MetricCard
	label={t(messages, 'dashboard.widgets.storage')}
	value={percent(pct)}
	hint={`${bytes(used)} / ${bytes(total)}`}
	icon={HardDrive}
>
	{#snippet trend()}
		<Progress value={pct} class="h-1.5" aria-label="Storage usage" />
	{/snippet}
</MetricCard>
