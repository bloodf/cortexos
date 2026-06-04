<!--
  /docker/[id] — single-container detail page.

  Renders the `ContainerDetail` component with the loaded data.
  The "Start" / "Stop" / "Restart" / "Remove" buttons submit to
  the form actions defined in `+page.server.ts`. The hidden
  `approvalToken` input is populated from the per-action token
  the server minted on the page render (PB-5).
-->
<script lang="ts">
  import type { PageData, ActionData } from './$types';
  import ContainerDetail from '$lib/components/docker/ContainerDetail.svelte';
  import { t } from '$lib/i18n';

  interface Props {
    data: PageData;
    form: ActionData;
  }

  let { data, form }: Props = $props();

  // Per-action loading flag — flipped when the user clicks the
  // matching button. Reset on a timer (the form action result
  // eventually lands and Svelte re-renders with `form` populated).
  let actionInFlight: 'start' | 'stop' | 'restart' | 'remove' | null = $state(null);

  function setAction(name: 'start' | 'stop' | 'restart' | 'remove'): void {
    actionInFlight = name;
    setTimeout(() => {
      if (actionInFlight === name) actionInFlight = null;
    }, 800);
  }

  const title = $derived(data.container.name);
</script>

<svelte:head>
  <title>{title} · {t(data.messages, 'app.nav.docker')} · CortexOS</title>
</svelte:head>

<form
  method="POST"
  data-slot="container-detail-form"
  data-container-id={data.container.id}
  class="contents"
>
  <!--
    Hidden approval tokens. One per action so the server can
    verify + consume the right one. The page-load mints them
    with a 60s TTL.
  -->
  {#if data.isAdmin}
    <input type="hidden" name="approvalToken" formaction="?/start" value={data.approvalTokens.start ?? ''} />
    <input type="hidden" name="approvalToken" formaction="?/stop" value={data.approvalTokens.stop ?? ''} />
    <input type="hidden" name="approvalToken" formaction="?/restart" value={data.approvalTokens.restart ?? ''} />
    <input type="hidden" name="approvalToken" formaction="?/remove" value={data.approvalTokens.remove ?? ''} />
  {/if}

  <ContainerDetail
    messages={data.messages}
    container={data.container}
    starting={actionInFlight === 'start'}
    stopping={actionInFlight === 'stop'}
    restarting={actionInFlight === 'restart'}
    removing={actionInFlight === 'remove'}
  />
</form>
