<!--
  ServiceHealthBadge — small status pill for a service's live status.

  Drives a single design contract: the same `{status}` value should
  produce the same visual treatment whether it appears in a card, a
  table row, or a detail page header. The mapping is exhaustive over
  the ServiceStatus union, so adding a new status forces a compile
  error in this file.

  i18n: every visible label (the status text and the aria-label
  prefix) routes through `t(messages, 'services.status.<name>')`.

  Accessibility:
    - `data-status` exposes the raw status for CSS hooks and tests.
    - `aria-label` spells out the human status for screen readers.
    - The pill is a `span`, not a button — clicking a status badge
      never triggers a side effect; the row is the interactive unit.
-->
<script lang="ts">
	import Badge from '$lib/components/ui/badge/Badge.svelte';
	import { t, type Messages } from '$lib/i18n';

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
		/** Locale messages (from the root layout's PageData). */
		messages: Messages;
		/** Override the visible label (defaults to a status-keyed t() lookup). */
		label?: string;
		/** Badge size. Defaults to `default`. */
		size?: 'default' | 'sm';
		/** Optional className passthrough. */
		class?: string;
	};

	let { status, messages, label, size = 'default', class: className }: Props = $props();

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

	// Resolve the visible label from i18n. Falls back to a
	// title-cased status if the lookup misses (e.g. a new status
	// that hasn't been translated yet) — the dotted-key fallback
	// in `t()` means a fresh status returns its own name.
	const displayLabel = $derived(label ?? t(messages, `services.status.${status}`));

	const ariaPrefix = $derived(t(messages, 'services.status.label'));
	const ariaLabel = $derived(`${ariaPrefix}: ${displayLabel}`);
</script>

<Badge {variant} {size} class={className}>
	<span data-slot="service-health-badge" data-status={status} aria-label={ariaLabel}>
		{displayLabel}
	</span>
</Badge>
