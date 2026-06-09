<!--
  StatusBadge — colored dot + status label + optional response time.

  Mirrors the sys-pilot StatusBadge primitive. Used in app cards and the
  healthcheck table so status semantics are consistent everywhere.
-->
<script lang="ts">
	import { cn } from '$lib/utils/cn';
	import { t, type Messages } from '$lib/i18n';
	import type { ServiceStatusLit } from '$lib/components/services/adapter';

	type Props = {
		status: ServiceStatusLit;
		messages: Messages;
		responseMs?: number | null;
		compact?: boolean;
		class?: string;
	};

	let {
		status,
		messages,
		responseMs = null,
		compact = false,
		class: className = ''
	}: Props = $props();

	const label = $derived(t(messages, `services.status.${status}`));

	const dotClass = $derived.by((): string => {
		switch (status) {
			case 'online':
				return 'bg-success';
			case 'offline':
				return 'bg-destructive';
			case 'checking':
				return 'bg-warning animate-pulse';
			case 'degraded':
				return 'bg-warning';
			case 'unknown':
			default:
				return 'bg-muted-foreground';
		}
	});

	const pillClass = $derived.by((): string => {
		switch (status) {
			case 'online':
				return 'bg-success/10 text-success';
			case 'offline':
				return 'bg-destructive/10 text-destructive';
			case 'checking':
				return 'bg-warning/10 text-warning';
			case 'degraded':
				return 'bg-warning/10 text-warning';
			case 'unknown':
			default:
				return 'bg-muted text-muted-foreground';
		}
	});

	const msLabel = $derived(
		responseMs != null && responseMs >= 0 ? `${Math.round(responseMs)} ms` : null
	);
</script>

<span
	class={cn(
		'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium',
		pillClass,
		className
	)}
>
	<span class={cn('size-1.5 rounded-full', dotClass)} aria-hidden="true"></span>
	{#if !compact}
		<span>{label}</span>
		{#if status === 'online' && msLabel}
			<span class="tabular-nums opacity-70">· {msLabel}</span>
		{/if}
	{/if}
</span>
