<!--
  ContainerStateBadge — small status pill for a docker container's
  state. Drives a single design contract: the same `{state}` value
  should produce the same visual treatment wherever it appears.

  i18n: every visible label routes through `t(messages, 'docker.status.<state>')`.
  Accessibility:
    - `data-state` exposes the raw state for CSS hooks and tests.
    - `aria-label` spells out the human state for screen readers.
    - The pill is a `span`, not a button — clicking a state badge
      never triggers a side effect; the row is the interactive unit.
-->
<script lang="ts">
  import Badge from '$lib/components/ui/badge/Badge.svelte';
  import { t, type Messages } from '$lib/i18n';
  import { stateVariant, type ContainerStateLit } from './adapter';

  type Props = {
    /** The live container state. */
    state: ContainerStateLit;
    /** Locale messages (from the root layout's PageData). */
    messages: Messages;
    /** Override the visible label. */
    label?: string;
    /** Badge size. */
    size?: 'default' | 'sm';
    /** Optional className passthrough. */
    class?: string;
  };

  let { state, messages, label, size = 'default', class: className }: Props = $props();

  const variant = $derived(stateVariant(state));
  const displayLabel = $derived(label ?? t(messages, `docker.status.${state}`));
  const ariaPrefix = $derived(t(messages, 'docker.status.label'));
  const ariaLabel = $derived(`${ariaPrefix}: ${displayLabel}`);
</script>

<Badge {variant} {size} class={className}>
  <span data-slot="container-state-badge" data-state={state} aria-label={ariaLabel}>
    {displayLabel}
  </span>
</Badge>
