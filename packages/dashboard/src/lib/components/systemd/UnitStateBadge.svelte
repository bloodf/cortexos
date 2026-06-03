<!--
  UnitStateBadge — small status pill for a systemd unit's active state.

  The mapping is exhaustive over the `SystemdActiveState` union — adding
  a new state to the contracts package forces a compile error here.

  i18n: every visible label routes through `t(messages, 'systemd.status.<state>')`.

  Accessibility:
    - `data-state` exposes the raw state for CSS hooks and tests.
    - `aria-label` spells out the human status for screen readers.
    - The pill is a `span`, not a button — clicking a state badge
      never triggers a side effect; the row is the interactive unit.
-->
<script lang="ts">
	import Badge from '$lib/components/ui/badge/Badge.svelte';
	import { t, type Messages } from '$lib/i18n';

	/**
	 * Mirror the `SystemdActiveState` union from @cortexos/contracts.
	 * Declared inline so the switch in `computeVariant` is statically
	 * analysed by svelte-check (the contracts' Zod-inferred type is
	 * opaque to the Svelte compiler).
	 */
	type ActiveState =
		| 'active'
		| 'inactive'
		| 'failed'
		| 'activating'
		| 'deactivating'
		| 'reloading'
		| 'maintenance'
		| 'unknown';

	type Variant = 'success' | 'warning' | 'destructive' | 'info' | 'secondary' | 'outline';

	type Props = {
		/** The unit's active state. */
		state: ActiveState;
		/** Locale messages (from the root layout's PageData). */
		messages: Messages;
		/** Optional override for the visible label. */
		label?: string;
		/** Badge size. Defaults to `default`. */
		size?: 'default' | 'sm';
		/** Optional className passthrough. */
		class?: string;
	};

	let { state, messages, label, size = 'default', class: className }: Props = $props();

	/**
	 * Map an `ActiveState` to a design-system `Badge` variant. The
	 * switch is exhaustive — adding a state to the contracts union
	 * without updating this map is a compile error.
	 */
	function computeVariant(s: ActiveState): Variant {
		switch (s) {
			case 'active':
				return 'success';
			case 'failed':
				return 'destructive';
			case 'inactive':
				return 'secondary';
			case 'activating':
			case 'reloading':
				return 'info';
			case 'deactivating':
			case 'maintenance':
				return 'warning';
			case 'unknown':
				return 'outline';
			default: {
				// Exhaustiveness check: the `never` branch fails the
				// compile if a new state is added without a handler.
				const _exhaustive: never = s;
				return _exhaustive;
			}
		}
	}

	const variant: Variant = $derived(computeVariant(state));

	// Resolve the visible label from i18n. Falls back to the raw state
	// name when the translation is missing (dotted-key fallback).
	const displayLabel = $derived(label ?? t(messages, `systemd.status.${state}`));

	const ariaPrefix = $derived(t(messages, 'systemd.status.label'));
	const ariaLabel = $derived(`${ariaPrefix}: ${displayLabel}`);
</script>

<Badge {variant} {size} class={className}>
	<span data-slot="unit-state-badge" data-state={state} aria-label={ariaLabel}>
		{displayLabel}
	</span>
</Badge>
