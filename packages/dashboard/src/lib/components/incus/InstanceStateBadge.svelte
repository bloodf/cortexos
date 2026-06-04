<!--
  InstanceStateBadge — small status pill for an Incus instance.

  The mapping is exhaustive over the 9-state `IncusStatusLit` union
  (draft|validated|provisioning|active|failed|running|stopped|frozen|error).
  Adding a state to the contracts package forces a compile error here.

  i18n: every visible label routes through `t(messages, 'incus.status.<state>')`.

  Accessibility:
    - `data-state` exposes the raw state for CSS hooks and tests.
    - `aria-label` spells out the human status for screen readers.
    - The pill is a `span`, not a button — clicking a state badge
      never triggers a side effect; the row is the interactive unit.
-->
<script lang="ts">
  import Badge from '$lib/components/ui/badge/Badge.svelte';
  import { t, type Messages } from '$lib/i18n';
  import { stateVariant, type IncusStatusLit } from './adapter';

  type Props = {
    /** The instance's status. */
    state: IncusStatusLit;
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

  // Map the status to a design-system Badge variant. The switch is
  // exhaustive — adding a state without a handler is a compile error.
  const variant = $derived(stateVariant(state));

  // Resolve the visible label from i18n. Falls back to the raw state
  // name when the translation is missing (dotted-key fallback).
  const displayLabel = $derived(label ?? t(messages, `incus.status.${state}`));

  const ariaPrefix = $derived(t(messages, 'incus.status.label'));
  const ariaLabel = $derived(`${ariaPrefix}: ${displayLabel}`);
</script>

<Badge {variant} {size} class={className}>
  <span data-slot="instance-state-badge" data-state={state} aria-label={ariaLabel}>
    {displayLabel}
  </span>
</Badge>
