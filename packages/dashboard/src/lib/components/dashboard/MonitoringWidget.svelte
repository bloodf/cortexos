<script lang="ts">
	import WidgetShell from '$lib/components/ui/widget-shell/WidgetShell.svelte';
	import BarChart3 from '$lib/icons/BarChart3.svelte';
	import type { Service } from '@cortexos/contracts';
	import type { Messages } from '$lib/i18n';

	interface Props {
		services: Service[];
		messages: Messages;
	}

	let { services, messages }: Props = $props();

	const mon = $derived(services.filter((s) => s.category === 'Monitoring'));
</script>

<WidgetShell title="Monitoring" icon={BarChart3} scroll>
	<div class="space-y-2 text-sm">
		{#each mon as s (s.slug)}
			<div class="flex items-center justify-between gap-2">
				<span class="flex items-center gap-2 min-w-0">
					<span
						class="size-2 rounded-full shrink-0"
						style="background: {s.status === 'online'
							? 'var(--success)'
							: 'var(--destructive)'}"
					/>
					<span class="truncate">{s.name}</span>
				</span>
				<span class="text-xs text-muted-foreground tabular-nums shrink-0">
					{s.responseMs != null && s.responseMs > 0 ? `${Math.round(s.responseMs)} ms` : '—'}
				</span>
			</div>
		{:else}
			<p class="text-xs text-muted-foreground">No monitoring services found.</p>
		{/each}
	</div>
</WidgetShell>
