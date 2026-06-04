<!--
  InstanceActionBar — admin-gated action bar for a single Incus instance.

  Renders one button per action: start / stop / restart / delete.
  Destructive actions (stop, restart, delete) are marked with a
  visible "Requires approval" hint and a `data-destructive` attribute
  on the wrapping button so the page layer can wire the approval
  flow consistently with PB-5.

  The component is presentational. Click dispatch + the approval
  mint flow live in the page layer (`+page.svelte` +
  `+page.server.ts`); the bar only emits `onAction(action)` so the
  page can keep the form-action protocol (works without JS too).

  i18n: every visible string routes through `t(messages, 'incus.actions.*')`.
-->
<script lang="ts">
  import Button from '$lib/components/ui/Button.svelte';
  import { t, type Messages } from '$lib/i18n';
  import { DESTRUCTIVE_ACTIONS, type IncusActionKind } from './adapter';

  type Props = {
    /** Whether the bar is interactive (admin only). */
    canAct: boolean;
    /** Locale messages (from the root layout's PageData). */
    messages: Messages;
    /** Click handler. The action is forwarded to the page layer. */
    onAction?: (action: IncusActionKind) => void;
    /** Whether an action is currently in flight. */
    pending?: boolean;
    /** Optional className passthrough. */
    class?: string;
  };

  let { canAct, messages, onAction, pending = false, class: className }: Props = $props();

  const adminHint = $derived(t(messages, 'incus.actions.adminOnly'));
  const approvalHint = $derived(t(messages, 'incus.actions.requiresApproval'));
  const regionLabel = $derived(t(messages, 'incus.actions.label'));

  function handle(action: IncusActionKind): void {
    if (!onAction) return;
    if (!canAct) return;
    if (pending) return;
    onAction(action);
  }
</script>

<div
  data-slot="instance-action-bar"
  class={`flex flex-wrap items-center gap-2 ${className ?? ''}`}
  role="toolbar"
  aria-label={regionLabel}
>
  {#each ['start', 'stop', 'restart', 'delete'] as action (action)}
    {@const isDestructive = DESTRUCTIVE_ACTIONS.has(action as IncusActionKind)}
    <span
      data-slot="instance-action-button"
      data-action={action}
      data-destructive={isDestructive ? 'true' : 'false'}
    >
      <Button
        variant={isDestructive ? 'destructive' : 'outline'}
        size="sm"
        disabled={!canAct || pending}
        ariaLabel={`${t(messages, `incus.actions.${action}`)}${isDestructive ? ` (${approvalHint})` : ''}${!canAct ? ` (${adminHint})` : ''}`}
        onclick={() => handle(action as IncusActionKind)}
      >
        {t(messages, `incus.actions.${action}`)}
      </Button>
    </span>
  {/each}
</div>
