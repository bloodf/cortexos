<!--
  UnitActionBar — admin-gated action bar for a single systemd unit.

  Renders one button per action: start / stop / restart / reload /
  enable / disable. Destructive actions (restart, stop, disable)
  are marked with a visible "Requires approval" hint and a
  `data-destructive` attribute on the wrapping button so the page
  layer can wire the approval flow consistently with PB-5.

  The component is presentational. Click dispatch + the approval
  mint flow live in the page layer (`+page.svelte` +
  `+page.server.ts`); the bar only emits `onAction(action)` so the
  page can keep the form-action protocol (works without JS too).

  i18n: every visible string routes through `t(messages, 'systemd.*')`.
-->
<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import { t, type Messages } from '$lib/i18n';
	import { DESTRUCTIVE_ACTIONS, type UnitActionKind } from './adapter';

	type Props = {
		/** Whether the bar is interactive (admin only). When false, the
		 *  buttons render as `disabled` with a reason aria-label. */
		canAct: boolean;
		/** Locale messages (from the root layout's PageData). */
		messages: Messages;
		/** Click handler. The action is forwarded to the page layer. */
		onAction?: (action: UnitActionKind) => void;
		/** Whether an action is currently in flight (any button shows loading). */
		pending?: boolean;
		/** Optional className passthrough. */
		class?: string;
	};

	let { canAct, messages, onAction, pending = false, class: className }: Props = $props();

	const adminHint = $derived(t(messages, 'systemd.actions.adminOnly'));
	const approvalHint = $derived(t(messages, 'systemd.actions.requiresApproval'));

	function handle(action: UnitActionKind): void {
		if (!onAction) return;
		if (!canAct) return;
		if (pending) return;
		onAction(action);
	}
</script>

<div
	data-slot="unit-action-bar"
	class={`flex flex-wrap items-center gap-2 ${className ?? ''}`}
	role="toolbar"
	aria-label={t(messages, 'systemd.actions.label')}
>
	{#each ['start', 'stop', 'restart', 'reload', 'enable', 'disable'] as action (action)}
		{@const isDestructive = DESTRUCTIVE_ACTIONS.has(action as UnitActionKind)}
		<span
			data-slot="unit-action-button"
			data-action={action}
			data-destructive={isDestructive ? 'true' : 'false'}
		>
			<Button
				variant="outline"
				size="sm"
				disabled={!canAct || pending}
				ariaLabel={`${t(messages, `systemd.actions.${action}`)}${isDestructive ? ` (${approvalHint})` : ''}${!canAct ? ` (${adminHint})` : ''}`}
				onclick={() => handle(action as UnitActionKind)}
			>
				{t(messages, `systemd.actions.${action}`)}
			</Button>
		</span>
	{/each}
</div>
