<!--
  /systemd/[name] — single-unit detail page.

  Renders the `UnitDetail` component with the loaded data. The
  action bar submits the `?/default` form action defined in
  `+page.server.ts`. Destructive actions (restart, stop, disable)
  require an approval token (PB-5); the page fetches a token via
  `POST /api/approvals` before submitting.

  i18n: the `data.messages` map flows from the root layout and is
  passed straight through to UnitDetail.
-->
<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import UnitDetail from '$lib/components/systemd/UnitDetail.svelte';
	import { t } from '$lib/i18n';
	import type { SystemdActionKind } from '@cortexos/contracts';
	import type { UnitActionKind } from '$lib/components/systemd/adapter';

	interface Props {
		data: PageData;
		form: ActionData;
	}

	let { data, form }: Props = $props();

	// Active action — drives the pending spinner on the action bar.
	let pending = $state<UnitActionKind | null>(null);

	// Toast-style message (set on form-action return).
	const lastMessage = $derived.by(() => {
		if (!form) return null;
		if (form.ok) return { kind: 'ok' as const, text: `OK: ${form.action} ${form.name}` };
		return { kind: 'err' as const, text: form.error ?? 'Action failed' };
	});

	function isUnitAction(a: SystemdActionKind): a is UnitActionKind {
		return a !== 'status' && a !== 'list-units';
	}

	/**
	 * Build the `actionHash` for a destructive action and mint an
	 * approval token via the admin approvals API. The token's
	 * `actionHash` must equal the bridge-computed hash; the bridge
	 * rejects on mismatch.
	 */
	async function mintApprovalToken(action: SystemdActionKind, name: string): Promise<string> {
		const res = await fetch('/api/approvals', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				action: `systemd.${action}`,
				payload: { name },
				ttlSec: 60,
			}),
		});
		if (!res.ok) {
			const body = (await res.json().catch(() => ({}))) as { message?: string };
			throw new Error(body.message ?? `Failed to mint approval token (${res.status})`);
		}
		const body = (await res.json()) as { token?: string };
		if (!body.token) {
			throw new Error('Approval token response did not include a token');
		}
		return body.token;
	}

	async function handleAction(action: UnitActionKind): Promise<void> {
		if (!isUnitAction(action as SystemdActionKind)) return;
		if (pending) return;
		pending = action;
		try {
			const fd = new FormData();
			fd.set('action', action);
			fd.set('name', data.unit.name);
			// For destructive actions, mint a fresh approval token.
			// The actionHash on the token is bound to (action, name)
			// and verified by the bridge.
			if (action === 'restart' || action === 'stop' || action === 'disable') {
				const token = await mintApprovalToken(action, data.unit.name);
				fd.set('approvalToken', token);
			}
			// Submit through the form element so the progressive
			// enhancement story stays intact (works without JS too
			// for non-destructive actions, where the page can render
			// a `<button type="submit" name="action" value="start">`
			// instead of a JS handler).
			const formEl = document.getElementById('unit-action-form') as HTMLFormElement | null;
			if (formEl) {
				// Populate the hidden inputs and submit.
				const actionInput = formEl.querySelector(
					'input[name="action"]',
				) as HTMLInputElement | null;
				const nameInput = formEl.querySelector(
					'input[name="name"]',
				) as HTMLInputElement | null;
				const tokenInput = formEl.querySelector(
					'input[name="approvalToken"]',
				) as HTMLInputElement | null;
				if (actionInput) actionInput.value = action;
				if (nameInput) nameInput.value = data.unit.name;
				if (tokenInput) tokenInput.value = fd.get('approvalToken')?.toString() ?? '';
				formEl.requestSubmit();
			}
		} catch (e) {
			// Surface the error to the user. The form action result
			// (if any) will refresh via the next `form` prop update.
			console.error('Failed to dispatch action', e);
		} finally {
			// We don't know when the response returns; reset the flag
			// on a generous timer. Real implementation can hook into
			// the form's `submit` event lifecycle.
			setTimeout(() => {
				pending = null;
			}, 800);
		}
	}

	const title = $derived(data.unit.name);
</script>

<svelte:head>
	<title>{title} · {t(data.messages, 'app.nav.systemd')} · CortexOS</title>
</svelte:head>

{#if lastMessage}
	<div
		data-slot="unit-action-toast"
		data-kind={lastMessage.kind}
		role="status"
		class={lastMessage.kind === 'ok'
			? 'rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success'
			: 'rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive'}
	>
		{lastMessage.text}
	</div>
{/if}

<form
	id="unit-action-form"
	method="POST"
	action="?/default"
	data-slot="unit-action-form"
	class="contents"
>
	<input type="hidden" name="action" value="" />
	<input type="hidden" name="name" value={data.unit.name} />
	<input type="hidden" name="approvalToken" value="" />
	<UnitDetail
		messages={data.messages}
		unit={data.unit}
		logs={data.logs}
		isAdmin={data.isAdmin}
		onAction={handleAction}
		pending={pending !== null}
	/>
</form>
