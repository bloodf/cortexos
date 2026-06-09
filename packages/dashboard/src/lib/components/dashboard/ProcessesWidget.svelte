<script lang="ts">
	import WidgetShell from '$lib/components/ui/widget-shell/WidgetShell.svelte';
	import Cpu from '$lib/icons/Cpu.svelte';
	import type { ProcessInfo } from '$lib/types/dashboard';
	import type { Messages } from '$lib/i18n';
	import { t } from '$lib/i18n';

	interface Props {
		processes: ProcessInfo[];
		messages: Messages;
	}

	let { processes, messages }: Props = $props();

	const top = $derived([...processes].sort((a, b) => b.cpu - a.cpu).slice(0, 6));
</script>

<WidgetShell title={t(messages, 'dashboard.widgets.processes')} icon={Cpu} scroll>
	<table class="w-full text-sm">
		<thead>
			<tr class="text-[10px] uppercase tracking-wide text-muted-foreground">
				<th class="text-left py-1 font-medium">PID</th>
				<th class="text-left font-medium">User</th>
				<th class="text-left font-medium">Command</th>
				<th class="text-right font-medium">CPU</th>
				<th class="text-right font-medium">MEM</th>
			</tr>
		</thead>
		<tbody>
			{#each top as p (p.pid)}
				<tr class="border-t">
					<td class="py-1.5 font-mono tabular-nums">{p.pid}</td>
					<td class="truncate max-w-[120px]">{p.user}</td>
					<td class="font-mono text-xs truncate max-w-[220px]">{p.command}</td>
					<td class="text-right tabular-nums">{p.cpu.toFixed(1)}%</td>
					<td class="text-right tabular-nums">{p.mem.toFixed(1)}%</td>
				</tr>
			{/each}
		</tbody>
	</table>
</WidgetShell>
