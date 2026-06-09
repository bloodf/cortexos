<script lang="ts">
	import WidgetShell from '$lib/components/ui/widget-shell/WidgetShell.svelte';
	import BarChart3 from '$lib/icons/BarChart3.svelte';
	import type { Service } from '$lib/server/entities';
	import type { Messages } from '$lib/i18n';
	import { t } from '$lib/i18n';

	interface Props {
		services: Service[];
		messages: Messages;
	}

	let { services, messages }: Props = $props();

	const mon = $derived(services.filter((s) => s.category === 'Monitoring'));
</script>

<WidgetShell title={t(messages, 'dashboard.widgets.mon')} icon={BarChart3} scroll>
	<div class="space-y-2 text-sm">
		{#each mon as s (s.id)}
			<div class="flex items-center justify-between gap-2">
				<span class="flex items-center gap-2 min-w-0">
					<span
						class="size-2 rounded-full shrink-0"
						style="background: {s.status === 'online'
							? 'var(--success)'
							: s.status === 'offline'
								? 'var(--destructive)'
								: 'var(--muted-foreground)'};"
					></span>
					<span class="truncate">{s.name}</span>
				</span>
				<span class="text-xs text-muted-foreground tabular-nums shrink-0 capitalize">{s.status}</span>
			</div>
		{/each}
	</div>
</WidgetShell>
