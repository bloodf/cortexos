<script lang="ts">
	import { cn } from '$lib/utils/cn';
	import AlertTriangle from '$lib/icons/AlertTriangle.svelte';
	import CheckCircle from '$lib/icons/CheckCircle.svelte';
	import XCircle from '$lib/icons/XCircle.svelte';
	import type { SystemData } from '$lib/types/dashboard';
	import type { Service } from '$lib/server/entities';

	interface Props {
		services?: Service[];
		system?: SystemData | null;
		class?: string;
	}

	let { services = [], system = null, class: className = '' }: Props = $props();

	const down = $derived(services.filter((s) => s.status === 'offline').length);
	const total = $derived(services.length);
	const cpu = $derived(system?.cpu ?? 0);
	const mem = $derived(system?.memory.percent ?? 0);

	const level = $derived.by(() => {
		if (down > 0) return 'down';
		if (cpu > 85 || mem > 88) return 'warn';
		return 'ok';
	});

	const label = $derived.by(() => {
		if (level === 'down') return `${down} service${down > 1 ? 's' : ''} offline`;
		if (level === 'warn') return 'Elevated load';
		return 'All systems operational';
	});

	const detail = $derived.by(() => {
		if (level === 'down') {
			return `${total - down} of ${total} healthy · CPU ${Math.round(cpu)}% · Mem ${Math.round(mem)}%`;
		}
		if (level === 'warn') {
			return `CPU ${Math.round(cpu)}% · Mem ${Math.round(mem)}% · ${total} services online`;
		}
		return `${total} services online · CPU ${Math.round(cpu)}% · Mem ${Math.round(mem)}%`;
	});

	const Icon = $derived(level === 'ok' ? CheckCircle : level === 'warn' ? AlertTriangle : XCircle);
	const tone = $derived(
		{
			ok: 'bg-[var(--success)]/10 text-[var(--success)] border-[var(--success)]/30',
			warn: 'bg-[var(--warning)]/10 text-[var(--warning)] border-[var(--warning)]/40',
			down: 'bg-destructive/10 text-destructive border-destructive/40',
		}[level],
	);
</script>

<div class={cn('rounded-lg border bg-card overflow-hidden', className)}>
	<div class={cn('flex items-center gap-3 px-4 py-3 border-b', tone)}>
		<Icon class="h-5 w-5 shrink-0" />
		<div class="min-w-0">
			<p class="font-medium leading-none">{label}</p>
			<p class="mt-1 text-xs opacity-80">{detail}</p>
		</div>
		<div class="ml-auto hidden sm:flex items-center gap-3 text-xs">
			<div class="text-right">
				<div class="text-[10px] uppercase tracking-wide opacity-60">Services</div>
				<div class="font-mono font-medium">{total - down}/{total}</div>
			</div>
			<div class="text-right">
				<div class="text-[10px] uppercase tracking-wide opacity-60">CPU</div>
				<div class="font-mono font-medium">{Math.round(cpu)}%</div>
			</div>
			<div class="text-right">
				<div class="text-[10px] uppercase tracking-wide opacity-60">Memory</div>
				<div class="font-mono font-medium">{Math.round(mem)}%</div>
			</div>
		</div>
	</div>
</div>
