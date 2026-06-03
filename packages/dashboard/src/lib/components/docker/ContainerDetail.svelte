<!--
  ContainerDetail — single docker container detail view.

  Composed of four sections:
    1. Header — name, image, state badge.
    2. Inspect — id, image, status, created, ports, networks, mounts,
       privileged flag.
    3. Action bar — start / stop / restart / remove, wired to the
       form actions on the parent page.
    4. Quick links — Logs, Exec, plus the placeholder Compose stack
       section (M3 wiring).

  The component is presentational; data fetching lives in
  +page.server.ts. The "Logs" / "Exec" buttons link to
  /docker/[id]/logs and /docker/[id]/exec respectively.

  i18n: every visible string routes through t(messages, 'docker.*').
-->
<script lang="ts">
  import type { DockerContainer } from '@cortexos/contracts';
  import { t, type Messages } from '$lib/i18n';
  import Card from '$lib/components/ui/card/Card.svelte';
  import CardHeader from '$lib/components/ui/card/CardHeader.svelte';
  import CardTitle from '$lib/components/ui/card/CardTitle.svelte';
  import CardDescription from '$lib/components/ui/card/CardDescription.svelte';
  import CardBody from '$lib/components/ui/card/CardBody.svelte';
  import Badge from '$lib/components/ui/badge/Badge.svelte';
  import ContainerStateBadge from './ContainerStateBadge.svelte';
  import ContainerActionBar from './ContainerActionBar.svelte';
  import type { ContainerStateLit } from './adapter';

  type Props = {
    /** The container record. */
    container: DockerContainer;
    /** Locale messages (from the root layout's PageData). */
    messages: Messages;
    /** Per-action loading flags. */
    starting?: boolean;
    stopping?: boolean;
    restarting?: boolean;
    removing?: boolean;
    /** Optional className passthrough. */
    class?: string;
  };

  let {
    container,
    messages,
    starting = false,
    stopping = false,
    restarting = false,
    removing = false,
    class: className,
  }: Props = $props();

  /** Icon monogram (first 1-2 chars of the name). */
  const monogram = $derived.by(() => {
    const n = container.name ?? '';
    const cleaned = n.replace(/[^a-z0-9]/gi, '');
    return cleaned.slice(0, 2).toUpperCase() || '?';
  });

  /** Truncate the container id for display. */
  const shortId = $derived.by(() => {
    const id = container.id;
    if (id.startsWith('sha256:')) return id.slice(7, 19);
    return id.slice(0, 12);
  });

  /** Pre-formatted port list, e.g. "3000:3000, 9090:9090". */
  const portsDisplay = $derived.by(() => {
    if (!container.ports || container.ports.length === 0) return '—';
    return container.ports.join(', ');
  });

  const networksDisplay = $derived.by(() => {
    if (!container.networks || container.networks.length === 0) return '—';
    return container.networks.join(', ');
  });

  const mountsDisplay = $derived.by(() => {
    if (!container.mounts || container.mounts.length === 0) return [];
    return container.mounts.map((m) =>
      m.mode === 'ro' ? `${m.source}:${m.destination}:ro` : `${m.source}:${m.destination}`,
    );
  });

  const fieldId = $derived(t(messages, 'docker.detail.fields.id'));
  const fieldImage = $derived(t(messages, 'docker.detail.fields.image'));
  const fieldState = $derived(t(messages, 'docker.detail.fields.state'));
  const fieldStatus = $derived(t(messages, 'docker.detail.fields.status'));
  const fieldCreated = $derived(t(messages, 'docker.detail.fields.created'));
  const fieldPorts = $derived(t(messages, 'docker.detail.fields.ports'));
  const fieldNetworks = $derived(t(messages, 'docker.detail.fields.networks'));
  const fieldMounts = $derived(t(messages, 'docker.detail.fields.mounts'));
  const fieldPrivileged = $derived(t(messages, 'docker.detail.fields.privileged'));

  const inspectTitle = $derived(t(messages, 'docker.detail.inspect'));
  const inspectDesc = $derived(t(messages, 'docker.detail.inspectDescription'));
  const logsLabel = $derived(t(messages, 'docker.actions.logs'));
  const execLabel = $derived(t(messages, 'docker.actions.exec'));
  const privilegedTrue = $derived(t(messages, 'docker.detail.privilegedTrue'));
  const privilegedFalse = $derived(t(messages, 'docker.detail.privilegedFalse'));
  const mountsEmpty = $derived(t(messages, 'docker.detail.mountsEmpty'));
  const actionsTitle = $derived(t(messages, 'docker.actions.title'));
  const actionsDesc = $derived(t(messages, 'docker.actions.description'));
</script>

<div data-slot="container-detail" class={`flex flex-col gap-6 ${className ?? ''}`}>
  <!-- Header -->
  <Card>
    <div class="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
      <div class="flex items-start gap-4">
        <div
          data-slot="container-icon"
          aria-hidden="true"
          class="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-lg font-bold text-white"
          style:background-color="#0ea5e9"
        >
          {monogram}
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <h1 class="text-xl font-semibold leading-tight">{container.name}</h1>
            <ContainerStateBadge
              {messages}
              state={container.state as ContainerStateLit}
            />
            {#if container.privileged}
              <Badge variant="destructive" size="sm">PRIVILEGED</Badge>
            {/if}
          </div>
          <CardDescription>
            <span class="font-mono text-xs">{container.image}</span>
          </CardDescription>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <a
          href={`/docker/${encodeURIComponent(container.id)}/logs`}
          data-slot="container-detail-logs-link"
          class="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
        >
          {logsLabel}
        </a>
        <a
          href={`/docker/${encodeURIComponent(container.id)}/exec`}
          data-slot="container-detail-exec-link"
          class="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
        >
          {execLabel}
        </a>
      </div>
    </div>
  </Card>

  <!-- Inspect -->
  <Card>
    <CardHeader>
      <CardTitle>{inspectTitle}</CardTitle>
      <CardDescription>{inspectDesc}</CardDescription>
    </CardHeader>
    <CardBody>
      <dl class="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-2 text-sm">
        <dt class="text-muted-foreground">{fieldId}</dt>
        <dd class="font-mono text-xs" data-slot="container-detail-id">{shortId}…</dd>
        <dt class="text-muted-foreground">{fieldImage}</dt>
        <dd class="font-mono text-xs">{container.image}</dd>
        <dt class="text-muted-foreground">{fieldState}</dt>
        <dd>
          <ContainerStateBadge
            {messages}
            state={container.state as ContainerStateLit}
            size="sm"
          />
        </dd>
        <dt class="text-muted-foreground">{fieldStatus}</dt>
        <dd>{container.status ?? '—'}</dd>
        <dt class="text-muted-foreground">{fieldCreated}</dt>
        <dd class="font-mono text-xs">{container.created}</dd>
        <dt class="text-muted-foreground">{fieldPorts}</dt>
        <dd class="font-mono text-xs">{portsDisplay}</dd>
        <dt class="text-muted-foreground">{fieldNetworks}</dt>
        <dd>{networksDisplay}</dd>
        <dt class="text-muted-foreground">{fieldPrivileged}</dt>
        <dd>{container.privileged ? privilegedTrue : privilegedFalse}</dd>
        <dt class="text-muted-foreground">{fieldMounts}</dt>
        <dd>
          {#if mountsDisplay.length === 0}
            <span class="text-muted-foreground">{mountsEmpty}</span>
          {:else}
            <ul class="space-y-1">
              {#each mountsDisplay as m (m)}
                <li class="font-mono text-xs">{m}</li>
              {/each}
            </ul>
          {/if}
        </dd>
      </dl>
    </CardBody>
  </Card>

  <!-- Action bar (lifecycle) -->
  <Card>
    <CardHeader>
      <CardTitle>{actionsTitle}</CardTitle>
      <CardDescription>{actionsDesc}</CardDescription>
    </CardHeader>
    <CardBody>
      <ContainerActionBar
        {container}
        {messages}
        {starting}
        {stopping}
        {restarting}
        {removing}
      />
    </CardBody>
  </Card>
</div>
