<!--
  /incus/[name] — single-instance detail page.

  Renders the `InstanceDetail` component + the `InstanceLogs`
  component + the `InstanceExecNamed` component. The action bar
  submits the `?/default` form action defined in
  `+page.server.ts`. Destructive actions (stop, restart, delete)
  require an approval token (PB-5); the page fetches a token via
  `POST /api/approvals` before submitting. Delete additionally
  requires a typed confirmation phrase.

  i18n: the `data.messages` map flows from the server load and is
  passed straight through to every child component.
-->
<script lang="ts">
  import type { PageData, ActionData } from './$types';
  import InstanceDetail from '$lib/components/incus/InstanceDetail.svelte';
  import InstanceLogs from '$lib/components/incus/InstanceLogs.svelte';
  import InstanceExecNamed from '$lib/components/incus/InstanceExecNamed.svelte';
  import { t } from '$lib/i18n';
  import type { IncusActionKind } from '$lib/server/incus/bridge';

  interface Props {
    data: PageData;
    form: ActionData;
  }

  let { data, form }: Props = $props();

  // Active action — drives the pending spinner on the action bar.
  let pending = $state<IncusActionKind | null>(null);

  // Delete confirmation: stores the typed phrase before submit.
  let deleteConfirmation = $state<string>('');

  // Toast-style message (set on form-action return).
  const lastMessage = $derived.by(() => {
    if (!form) return null;
    if ('ok' in form && form.ok) {
      return { kind: 'ok' as const, text: `OK: ${form.action} ${form.name}` };
    }
    if ('error' in form && form.error) {
      return { kind: 'err' as const, text: form.error };
    }
    return null;
  });

  /**
   * Build the `actionHash` for a destructive action and mint an
   * approval token via the admin approvals API. The token's
   * `actionHash` must equal the bridge-computed hash; the bridge
   * rejects on mismatch.
   */
  async function mintApprovalToken(action: IncusActionKind, name: string): Promise<string> {
    const res = await fetch('/api/approvals', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: `incus.${action}`,
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

  async function handleAction(action: IncusActionKind): Promise<void> {
    if (pending) return;
    pending = action;
    try {
      // Delete needs a typed confirmation phrase in the page
      // (the form below captures it).
      if (action === 'delete') {
        const confirmed = window.confirm(
          t(data.messages, 'incus.actions.deleteConfirm'),
        );
        if (!confirmed) {
          pending = null;
          return;
        }
        const phrase = window.prompt(
          t(data.messages, 'incus.actions.deletePrompt'),
        );
        if (phrase == null) {
          pending = null;
          return;
        }
        deleteConfirmation = phrase;
      }
      const fd = new FormData();
      fd.set('action', action);
      fd.set('name', data.instance.name);
      if (action === 'stop' || action === 'restart' || action === 'delete') {
        const token = await mintApprovalToken(action, data.instance.name);
        fd.set('approvalToken', token);
      }
      if (action === 'delete' && deleteConfirmation) {
        fd.set('confirmation', deleteConfirmation);
      }
      // Submit through the form element so the progressive
      // enhancement story stays intact.
      const formEl = document.getElementById('instance-action-form') as HTMLFormElement | null;
      if (formEl) {
        const actionInput = formEl.querySelector(
          'input[name="action"]',
        ) as HTMLInputElement | null;
        const nameInput = formEl.querySelector(
          'input[name="name"]',
        ) as HTMLInputElement | null;
        const tokenInput = formEl.querySelector(
          'input[name="approvalToken"]',
        ) as HTMLInputElement | null;
        const confirmInput = formEl.querySelector(
          'input[name="confirmation"]',
        ) as HTMLInputElement | null;
        if (actionInput) actionInput.value = action;
        if (nameInput) nameInput.value = data.instance.name;
        if (tokenInput) tokenInput.value = fd.get('approvalToken')?.toString() ?? '';
        if (confirmInput) confirmInput.value = fd.get('confirmation')?.toString() ?? '';
        formEl.requestSubmit();
      }
    } catch (e) {
      console.error('Failed to dispatch action', e);
    } finally {
      setTimeout(() => {
        pending = null;
      }, 800);
    }
  }

  const title = $derived(data.instance.name);
  const logsTitle = $derived(t(data.messages, 'incus.logs.title'));
  const logsDesc = $derived(
    t(data.messages, 'incus.logs.description').replace('{name}', data.instance.name),
  );
  const logsEmpty = $derived(t(data.messages, 'incus.logs.empty'));
</script>

<svelte:head>
  <title>{title} · {t(data.messages, 'app.nav.incus')} · CortexOS</title>
</svelte:head>

{#if lastMessage}
  <div
    data-slot="instance-action-toast"
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
  id="instance-action-form"
  method="POST"
  action="?/default"
  data-slot="instance-action-form"
  class="contents"
>
  <input type="hidden" name="action" value="" />
  <input type="hidden" name="name" value={data.instance.name} />
  <input type="hidden" name="approvalToken" value="" />
  <input type="hidden" name="confirmation" value="" />
  <InstanceDetail
    messages={data.messages}
    instance={data.instance}
    isAdmin={data.isAdmin}
    onAction={handleAction}
    pending={pending !== null}
  />
</form>

<div class="mt-6 flex flex-col gap-6">
  <InstanceExecNamed
    messages={data.messages}
    instanceName={data.instance.name}
    isAdmin={data.isAdmin}
  />
  <InstanceLogs
    messages={data.messages}
    logs={data.logs}
    title={logsTitle}
    description={logsDesc}
    emptyLabel={logsEmpty}
  />
</div>
