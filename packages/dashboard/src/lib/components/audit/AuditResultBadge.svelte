<!--
  AuditResultBadge — small status pill for an audit event's `result` field.

  Drives a single design contract: the same `{result}` value produces the same
  visual treatment whether it appears in the list, the detail page, or the CSV
  export. The mapping is exhaustive over the `AuditEvent['result']` union
  ('success' | 'failure' | 'denied' | 'error'), so adding a new result code
  forces a compile error here.

  i18n: every visible label routes through `t(messages, 'audit.result.<name>')`.

  Accessibility:
    - `data-result` exposes the raw result for CSS hooks and tests.
    - `aria-label` spells out the human result for screen readers.
    - The pill is a `span`, not a button — clicking a status badge never
      triggers a side effect; the row is the interactive unit.
-->
<script lang="ts">
	import Badge from '$lib/components/ui/badge/Badge.svelte';
	import { t, type Messages } from '$lib/i18n';

	/** Mirrors `AuditEvent['result']` from src/lib/server/entities.ts. */
	export type AuditResult = 'success' | 'failure' | 'denied' | 'error';

	type Variant = 'success' | 'destructive' | 'warning' | 'secondary';

	type Props = {
		/** The audit event's result. */
		result: AuditResult;
		/** Locale messages (from the root layout's PageData). */
		messages: Messages;
		/** Override the visible label (defaults to a result-keyed t() lookup). */
		label?: string;
		/** Badge size. Defaults to `default`. */
		size?: 'default' | 'sm';
		/** Optional className passthrough. */
		class?: string;
	};

	let { result, messages, label, size = 'default', class: className }: Props = $props();

	/**
	 * Map an `AuditResult` to a design-system `Badge` variant. The switch is
	 * exhaustive — adding a result code without updating this map is a compile
	 * error.
	 */
	function computeVariant(r: AuditResult): Variant {
		switch (r) {
			case 'success':
				return 'success';
			case 'failure':
				return 'destructive';
			case 'denied':
				return 'warning';
			case 'error':
				return 'secondary';
			default: {
				// Exhaustiveness check: the `never` branch fails the
				// compile if a new result is added without a handler.
				const _exhaustive: never = r;
				return _exhaustive;
			}
		}
	}

	const variant: Variant = $derived(computeVariant(result));

	// Resolve the visible label from i18n. The dotted-key fallback in `t()`
	// means a fresh result code returns its own name.
	const displayLabel = $derived(label ?? t(messages, `audit.result.${result}`));

	const ariaPrefix = $derived(t(messages, 'audit.result.label'));
	const ariaLabel = $derived(`${ariaPrefix}: ${displayLabel}`);
</script>

<Badge {variant} {size} class={className}>
	<span data-slot="audit-result-badge" data-result={result} aria-label={ariaLabel}>
		{displayLabel}
	</span>
</Badge>
