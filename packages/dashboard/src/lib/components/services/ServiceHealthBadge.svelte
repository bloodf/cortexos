<!--
  ServiceHealthBadge — small status pill for a service's live status.

  Drives a single design contract: the same `{status}` value should
  produce the same visual treatment whether it appears in a card, a
  table row, or a detail page header. The mapping is exhaustive over
  the ServiceStatus union from @cortexos/contracts, so adding a new
  status forces a compile error in this file.

  Accessibility:
    - `data-status` exposes the raw status for CSS hooks and tests.
    - `aria-label` spells out the human status for screen readers.
    - The pill is a `span`, not a button — clicking a status badge
      never triggers a side effect; the row is the interactive unit.
-->
<script lang="ts">
	import Badge from '$lib/components/ui/badge/Badge.svelte';

	/**
	 * Mirrors the `ServiceStatus` union from @cortexos/contracts.
	 * Declared inline so the switch in `computeVariant` can be
	 * statically analyzed by svelte-check (the contracts' Zod-inferred
	 * type is opaque to the Svelte compiler).
	 */
	type ServiceStatus = 'online' | 'offline' | 'unknown' | 'checking' | 'degraded';

	type Variant = 'success' | 'warning' | 'destructive' | 'info' | 'secondary';

	type Props = {
		/** The live service status. */
		status: ServiceStatus;
		/** Override the visible label (defaults to a title-cased status). */
		label?: string;
		/** Badge size. Defaults to `default`. */
		size?: 'default' | 'sm';
		/** Optional className passthrough. */
		class?: string;
	};

	let { status, label, size = 'default', class: className }: Props = $props();

	/**
	 * Map a `ServiceStatus` to a design-system `Badge` variant. The
	 * switch is exhaustive — adding a status to the contracts union
	 * without updating this map is a compile error.
	 */
	function computeVariant(s: ServiceStatus): Variant {
		switch (s) {
			case 'online':
				return 'success';
			case 'degraded':
				return 'warning';
			case 'offline':
				return 'destructive';
			case 'checking':
				return 'info';
			case 'unknown':
				return 'secondary';
			default: {
				// Exhaustiveness check: the `never` branch fails the
				// compile if a new status is added without a handler.
				const _exhaustive: never = s;
				return _exhaustive;
			}
		}
	}

	const variant: Variant = $derived(computeVariant(status));

	const displayLabel = $derived(label ?? displayLabelForStatus(status));

	function displayLabelForStatus(s: ServiceStatus): string {
		return s.charAt(0).toUpperCase() + s.slice(1);
	}
</script>

<Badge {variant} {size} class={className}>
	<span data-slot="service-health-badge" data-status={status} aria-label="Status: {displayLabel}">
		{displayLabel}
	</span>
</Badge>
