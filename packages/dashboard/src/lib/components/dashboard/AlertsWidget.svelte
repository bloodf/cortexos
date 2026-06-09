<script lang="ts">
	import WidgetShell from '$lib/components/ui/widget-shell/WidgetShell.svelte';
	import Badge from '$lib/components/ui/badge/Badge.svelte';
	import AlertTriangle from '$lib/icons/AlertTriangle.svelte';
	import { relativeTime } from '$lib/utils/format';
	import type { AlertHistory } from '$lib/types/dashboard';
	import type { Messages } from '$lib/i18n';
	import { t } from '$lib/i18n';

	interface Props {
		alerts: AlertHistory[];
		messages: Messages;
	}

	let { alerts, messages }: Props = $props();

	const rows = $derived(alerts.slice(0, 6));
</script>

<WidgetShell title={t(messages, 'dashboard.widgets.alerts')} icon={AlertTriangle} scroll>
	<div class="space-y-2 text-sm">
		{#each rows as a (a.id)}
			<div class="flex items-start gap-2 border-b last:border-0 pb-2 last:pb-0">
				<Badge
					variant={a.status === 'fired'
						? 'destructive'
						: a.status === 'resolved'
							? 'default'
							: 'secondary'}
					size="sm"
				>
					{a.status}
				</Badge>
				<div class="min-w-0 flex-1">
					<p class="truncate text-xs font-medium">{a.ruleName}</p>
					<p class="text-[10px] text-muted-foreground">{relativeTime(a.timestamp)}</p>
				</div>
			</div>
		{/each}
	</div>
</WidgetShell>
