<script lang="ts">
	import WidgetShell from '$lib/components/ui/widget-shell/WidgetShell.svelte';
	import Database from '$lib/icons/Database.svelte';
	import type { Service } from '$lib/server/entities';
	import type { Messages } from '$lib/i18n';
	import { t } from '$lib/i18n';

	interface Props {
		services: Service[];
		messages: Messages;
	}

	let { services, messages }: Props = $props();

	const dbs = $derived(services.filter((s) => s.category === 'Database'));
</script>

<WidgetShell title={t(messages, 'dashboard.widgets.db')} icon={Database} scroll>
	<div class="space-y-2 text-sm">
		{#each dbs as s (s.id)}
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
