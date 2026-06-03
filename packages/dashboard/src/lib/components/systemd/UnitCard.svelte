<!--
  UnitCard — single-unit card built on the design-system Card.

  Used in the systemd overview grid (the list page can also drive a
  grid view). The card is non-interactive on its own; navigation is
  driven by passing an `onSelect` handler, so the same component
  works in non-link surfaces (e.g. an admin side panel).

  i18n: every visible string routes through `t(messages, 'systemd.*')`.
-->
<script lang="ts">
	import type { SystemdUnit } from '@cortexos/contracts';
	import { t, type Messages } from '$lib/i18n';
	import Card from '$lib/components/ui/card/Card.svelte';
	import CardHeader from '$lib/components/ui/card/CardHeader.svelte';
	import CardTitle from '$lib/components/ui/card/CardTitle.svelte';
	import CardDescription from '$lib/components/ui/card/CardDescription.svelte';
	import CardBody from '$lib/components/ui/card/CardBody.svelte';
	import CardFooter from '$lib/components/ui/card/CardFooter.svelte';
	import UnitStateBadge from './UnitStateBadge.svelte';
	import { shortName } from './adapter';

	type Props = {
		/** The full unit record. The component never mutates it. */
		unit: SystemdUnit;
		/** Locale messages (from the root layout's PageData). */
		messages: Messages;
		/** Optional click handler (e.g. `navigate('/systemd/${name}')`). */
		onSelect?: (unit: SystemdUnit) => void;
		/** Optional className passthrough for layout grids. */
		class?: string;
	};

	let { unit, messages, onSelect, class: className }: Props = $props();

	const title = $derived(shortName(unit.name));
	const sub = $derived(unit.sub || unit.active);

	function handleClick(): void {
		if (onSelect) onSelect(unit);
	}

	function handleKey(event: KeyboardEvent): void {
		if (!onSelect) return;
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			onSelect(unit);
		}
	}
</script>

<Card size="default" class={className}>
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<div
		role={onSelect ? 'button' : undefined}
		tabindex={onSelect ? 0 : undefined}
		data-slot="unit-card"
		data-unit-name={unit.name}
		onclick={handleClick}
		onkeydown={handleKey}
		class="flex h-full cursor-pointer flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
	>
		<CardHeader>
			<div class="flex items-start gap-3">
				<div class="min-w-0 flex-1">
					<CardTitle>{title}</CardTitle>
					<CardDescription>
						<span class="line-clamp-1 font-mono text-xs">{unit.name}</span>
					</CardDescription>
				</div>
				<UnitStateBadge
					{messages}
					state={unit.active}
					size="sm"
				/>
			</div>
		</CardHeader>
		<CardBody>
			{#if unit.description}
				<p class="line-clamp-2 text-sm text-muted-foreground">{unit.description}</p>
			{/if}
		</CardBody>
		<CardFooter>
			<div class="flex w-full items-center justify-between gap-2 text-xs text-muted-foreground">
				<span data-slot="unit-sub">{sub}</span>
				<span data-slot="unit-enabled" class="inline-flex items-center gap-1">
					{unit.enabled
						? t(messages, 'systemd.status.enabled')
						: t(messages, 'systemd.status.disabled')}
				</span>
			</div>
		</CardFooter>
	</div>
</Card>
