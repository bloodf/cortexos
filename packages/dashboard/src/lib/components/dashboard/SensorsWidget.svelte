<script lang="ts">
	import WidgetShell from '$lib/components/ui/widget-shell/WidgetShell.svelte';
	import Thermometer from '$lib/icons/Thermometer.svelte';
	import Fan from '$lib/icons/Fan.svelte';
	import { tempColor } from '$lib/utils/status';
	import { cn } from '$lib/utils/cn';
	import type { SystemData } from '$lib/types/dashboard';
	import type { Messages } from '$lib/i18n';
	import { t } from '$lib/i18n';

	interface Props {
		system: SystemData | null;
		messages: Messages;
	}

	let { system, messages }: Props = $props();

	const temps = $derived(system?.sensors.temperatures ?? []);
	const fans = $derived(system?.sensors.fans ?? []);
</script>

<WidgetShell title={t(messages, 'dashboard.widgets.sensors')} icon={Thermometer} scroll>
	<div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
		{#each temps as t (t.id)}
			<div class="flex justify-between gap-2 min-w-0">
				<span class="text-muted-foreground truncate">{t.label}</span>
				<span class={cn('font-mono tabular-nums shrink-0', tempColor(t.value))}>
					{t.value.toFixed(1)}°
				</span>
			</div>
		{/each}
		{#each fans as f (f.id)}
			<div class="flex justify-between gap-2 min-w-0">
				<span class="text-muted-foreground truncate flex items-center gap-1">
					<Fan class="h-3 w-3 shrink-0" />
					{f.label}
				</span>
				<span class="font-mono tabular-nums shrink-0">{Math.round(f.value)}</span>
			</div>
		{/each}
	</div>
</WidgetShell>
