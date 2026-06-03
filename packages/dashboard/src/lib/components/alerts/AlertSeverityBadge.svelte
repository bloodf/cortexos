<!--
  AlertSeverityBadge — small pill for an alert severity value.

  Two distinct concerns use this:
    - rule-based alerts: severity comes from the rule (constant
      until the rule is edited).
    - operational alerts: severity comes from the row at firing
      time and may differ row to row.

  Both paths funnel through the same `severity` prop, so the
  visual treatment is identical regardless of source.

  i18n: visible label routes through `t(messages, 'alerts.severity.<name>')`.

  Accessibility:
    - `data-severity` exposes the raw value for CSS hooks + tests.
    - `aria-label` spells out the human severity.
    - The pill is a `span`, never a button.
-->
<script lang="ts">
	import Badge from '$lib/components/ui/badge/Badge.svelte';
	import { t, type Messages } from '$lib/i18n';

	/**
	 * Mirrors the contracts `AlertSeverity` union. Declared inline
	 * so the switch in `computeVariant` is exhaustively typed (the
	 * Zod-inferred contracts type is opaque to svelte-check).
	 */
	type AlertSeverity = 'info' | 'warning' | 'critical';

	type Variant = 'info' | 'warning' | 'destructive';

	type Props = {
		/** The alert severity. */
		severity: AlertSeverity;
		/** Locale messages (from the root layout's PageData). */
		messages: Messages;
		/** Optional override for the visible label. */
		label?: string;
		/** Badge size. Defaults to `default`. */
		size?: 'default' | 'sm';
		/** Optional className passthrough. */
		class?: string;
	};

	let { severity, messages, label, size = 'default', class: className }: Props = $props();

	function computeVariant(s: AlertSeverity): Variant {
		switch (s) {
			case 'info':
				return 'info';
			case 'warning':
				return 'warning';
			case 'critical':
				return 'destructive';
			default: {
				const _exhaustive: never = s;
				return _exhaustive;
			}
		}
	}

	const variant: Variant = $derived(computeVariant(severity));

	const displayLabel = $derived(label ?? t(messages, `alerts.severity.${severity}`));
	const ariaLabel = $derived(`Severity: ${displayLabel}`);
</script>

<Badge {variant} {size} class={className}>
	<span data-slot="alert-severity-badge" data-severity={severity} aria-label={ariaLabel}>
		{displayLabel}
	</span>
</Badge>
