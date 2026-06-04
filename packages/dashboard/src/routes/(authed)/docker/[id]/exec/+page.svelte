<!--
  /docker/[id]/exec — admin-only allowlisted exec page.

  PB-5: the form carries a per-action approval token, minted on
  the page render and consumed by the POST handler. PB-2 / SR-019:
  the allowlist rejects `bash -c <userstring>` at both the route
  layer AND the docker-bridge layer (defence in depth).

  The page loads the container, the allowlisted subcommand set,
  and the approval token; it renders the `ContainerExec` form
  with the right hidden field.
-->
<script lang="ts">
  import type { PageData, ActionData } from './$types';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import Container from '$lib/icons/Container.svelte';
  import ContainerExec from '$lib/components/docker/ContainerExec.svelte';
  import { t } from '$lib/i18n';

  interface Props {
    data: PageData;
    form: ActionData;
  }

  let { data, form }: Props = $props();

  const title = $derived(t(data.messages, 'docker.exec.title'));

  // `data.approvalToken` is either an `ApprovalToken` object (when
  // minted) or an empty string (no user / non-admin). Extract the
  // opaque token string; the form's hidden field needs a string.
  const tokenString = $derived(
    typeof data.approvalToken === 'string' ? data.approvalToken : data.approvalToken.token,
  );

  // The form action returns an optional `{ error?, output? }`
  // shape when invoked through SvelteKit's form-action dispatch.
  // The auto-inferred `ActionData` is `{} | null`; widen to a
  // shape that the ContainerExec component can consume.
  type ExecResult = { error?: string; output?: string };
  const formResult = $derived(form as ExecResult | null | undefined);

  let submitting = $state(false);

  function onSubmit(): void {
    submitting = true;
    setTimeout(() => {
      submitting = false;
    }, 800);
  }
</script>

<svelte:head>
  <title>{title} · {data.container.name} · {t(data.messages, 'app.nav.docker')} · CortexOS</title>
</svelte:head>

<div class="flex flex-col gap-6">
  <PageHeader
    {title}
    description={t(data.messages, 'docker.exec.description').replace('{name}', data.container.name)}
    icon={Container}
  />

  <form
    method="POST"
    data-slot="container-exec-page-form"
    data-container-id={data.container.id}
    class="contents"
    onsubmit={onSubmit}
  >
    <input type="hidden" name="approvalToken" value={tokenString} />
    <ContainerExec
      container={data.container}
      messages={data.messages}
      approvalToken={tokenString}
      allowedSubcommands={data.allowedSubcommands}
      {submitting}
      error={formResult?.error ?? null}
      output={formResult?.output ?? null}
    />
  </form>
</div>
