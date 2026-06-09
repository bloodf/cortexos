<script lang="ts">
	import WidgetShell from '$lib/components/ui/widget-shell/WidgetShell.svelte';
	import HardDrive from '$lib/icons/HardDrive.svelte';
	import { bytes } from '$lib/utils/format';
	import { usageBg, usageColor } from '$lib/utils/status';
	import { cn } from '$lib/utils/cn';
	import type { SystemData } from '$lib/types/dashboard';
	import type { Messages } from '$lib/i18n';
	import { t } from '$lib/i18n';

	interface Props {
		system: SystemData | null;
		messages: Messages;
	}

	let { system, messages }: Props = $props();
</script>

<WidgetShell title={t(messages, 'dashboard.widgets.drives')} icon={HardDrive} scroll>
	<div class="space-y-2">
		{#each system?.drives ?? [] as d (d.name)}
			{@const pct = d.percent ?? (d.total && d.used ? (d.used / d.total) * 100 : 0)}
			<div class="space-y-1">
				<div class="flex items-center justify-between gap-2 text-xs">
					<span class="font-mono truncate min-w-0">{d.name}</span>
					<span
						class={cn(
							'tabular-nums shrink-0',
							pct >= 90
								? 'text-destructive'
								: pct >= 75
									? 'text-[var(--warning)]'
									: 'text-muted-foreground',
						)}
					>
						{bytes(d.used ?? 0)} / {bytes(d.total ?? d.size)} · {pct.toFixed(0)}%
					</span>
				</div>
				<div class="h-1.5 rounded-full bg-muted overflow-hidden">
					<div class={cn('h-full', usageBg(pct))} style="width: {pct}%;"></div>
				</div>
			</div>
		{/each}
	</div>
</WidgetShell>
