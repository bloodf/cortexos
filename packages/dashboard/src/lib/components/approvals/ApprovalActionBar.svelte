<!--
  ApprovalActionBar — grant / revoke form-action buttons.

  The bar renders two forms (POST) pointing at the
  /api/approvals/[id]/grant and /api/approvals/[id]/revoke
  endpoints. Each form submits with a hidden `_csrf` field and the
  standard `?/action` query string so the page-server's form-action
  handlers run, OR the buttons can be used with `use:enhance` to
  call the API directly.

  i18n: every visible string routes through
  `t(messages, 'approvals.actions.*')`.
-->
<script lang="ts">
	import type { Approval } from './adapter';
	import { t, type Messages } from '$lib/i18n';
	import Button from '$lib/components/ui/Button.svelte';

	type Props = {
		/** The approval row the actions target. */
		approval: Approval;
		/** Locale messages (from the root layout's PageData). */
		messages: Messages;
		/** Path the grant endpoint is mounted at (default: /api/approvals). */
		apiBase?: string;
		/** Whether an action is in flight (disables both buttons). */
		busy?: boolean;
		/** Optional className passthrough. */
		class?: string;
	};

	let { approval, messages, apiBase = '/api/approvals', busy = false, class: className }: Props =
		$props();

	// Form action endpoints (server-routed handlers live on the page).
	const grantAction = $derived(`${apiBase}/${approval.id}/grant`);
	const revokeAction = $derived(`${apiBase}/${approval.id}/revoke`);

	const canGrant = $derived(approval.actionable);
	const canRevoke = $derived(approval.actionable);

	const ariaGrant = $derived(t(messages, 'approvals.actions.grant'));
	const ariaRevoke = $derived(t(messages, 'approvals.actions.revoke'));
</script>

<div
	class={['flex flex-wrap items-center gap-2', className].filter(Boolean).join(' ')}
	data-slot="approval-action-bar"
>
	<form
		method="POST"
		action={grantAction}
		data-slot="approval-grant-form"
		data-approval-id={approval.id}
	>
		<span data-slot="approval-grant-button">
			<Button
				type="submit"
				variant="default"
				size="sm"
				disabled={!canGrant || busy}
				ariaLabel={ariaGrant}
			>
				{t(messages, 'approvals.actions.grant')}
			</Button>
		</span>
	</form>

	<form
		method="POST"
		action={revokeAction}
		data-slot="approval-revoke-form"
		data-approval-id={approval.id}
	>
		<span data-slot="approval-revoke-button">
			<Button
				type="submit"
				variant="destructive"
				size="sm"
				disabled={!canRevoke || busy}
				ariaLabel={ariaRevoke}
			>
				{t(messages, 'approvals.actions.revoke')}
			</Button>
		</span>
	</form>
</div>
