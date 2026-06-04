<!--
  InstanceDetail — single-instance detail view.

  Composed of:
    1. Header — name, status badge, type pill.
    2. Action bar — start/stop/restart/delete.
    3. Fields — image, CPU, memory, config (target, network, hermes).
    4. Devices — root disk + network interfaces.
    5. Validation history — last_validation.

  The component is presentational; data fetching lives in
  `+page.server.ts`. Action buttons POST through the form-action
  protocol (the page wraps InstanceDetail in a <form>); the visible
  action bar dispatches via `onAction` for the page's JS-driven
  approval flow when the JS layer is loaded.

  i18n: every visible string routes through `t(messages, 'incus.*')`.
-->
<script lang="ts">
  import type { IncusInstance } from '@cortexos/contracts';
  import { t, type Messages } from '$lib/i18n';
  import Card from '$lib/components/ui/card/Card.svelte';
  import CardHeader from '$lib/components/ui/card/CardHeader.svelte';
  import CardTitle from '$lib/components/ui/card/CardTitle.svelte';
  import CardDescription from '$lib/components/ui/card/CardDescription.svelte';
  import CardBody from '$lib/components/ui/card/CardBody.svelte';
  import Badge from '$lib/components/ui/badge/Badge.svelte';
  import InstanceStateBadge from './InstanceStateBadge.svelte';
  import InstanceActionBar from './InstanceActionBar.svelte';
  import { formatResources, isRunning, type IncusStatusLit, type IncusActionKind } from './adapter';

  type Props = {
    /** The instance record. */
    instance: IncusInstance;
    /** Locale messages (from the root layout's PageData). */
    messages: Messages;
    /** True iff the current user is an admin (PB-5). */
    isAdmin: boolean;
    /** Click handler. The page wires the form-action protocol. */
    onAction?: (action: IncusActionKind) => void;
    /** Whether an action is currently in flight. */
    pending?: boolean;
    /** Optional className passthrough. */
    class?: string;
  };

  let {
    instance,
    messages,
    isAdmin,
    onAction,
    pending = false,
    class: className,
  }: Props = $props();

  const { cpu, memory } = $derived(formatResources(instance));
  const canAct = $derived(isAdmin);
  const running = $derived(isRunning(instance));
  const typeLabel = $derived(t(messages, `incus.types.${instance.type}`));

  const actionsTitle = $derived(t(messages, 'incus.detail.actions'));
  const actionsDesc = $derived(t(messages, 'incus.detail.actionsDescription'));
  const fieldsTitle = $derived(t(messages, 'incus.detail.fields.title'));
  const fieldsDesc = $derived(t(messages, 'incus.detail.fields.titleDescription'));
  const devicesTitle = $derived(t(messages, 'incus.detail.devices'));
  const devicesEmpty = $derived(t(messages, 'incus.detail.devicesEmpty'));
  const validationTitle = $derived(t(messages, 'incus.detail.validation'));
  const validationEmpty = $derived(t(messages, 'incus.detail.validationEmpty'));

  const fieldName = $derived(t(messages, 'incus.detail.fields.name'));
  const fieldType = $derived(t(messages, 'incus.detail.fields.type'));
  const fieldImage = $derived(t(messages, 'incus.detail.fields.image'));
  const fieldCpu = $derived(t(messages, 'incus.detail.fields.cpu'));
  const fieldMemory = $derived(t(messages, 'incus.detail.fields.memory'));
  const fieldCreated = $derived(t(messages, 'incus.detail.fields.created'));
  const fieldBranch = $derived(t(messages, 'incus.detail.fields.branch'));
  const fieldPool = $derived(t(messages, 'incus.detail.fields.pool'));
  const fieldBridge = $derived(t(messages, 'incus.detail.fields.bridge'));
  const fieldTailscale = $derived(t(messages, 'incus.detail.fields.tailscale'));
  const fieldHermes = $derived(t(messages, 'incus.detail.fields.hermes'));
</script>

<div data-slot="instance-detail" class={`flex flex-col gap-6 ${className ?? ''}`}>
  <!-- Header -->
  <Card>
    <div class="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <h1 class="text-xl font-semibold leading-tight" data-slot="instance-detail-title">
            {instance.name}
          </h1>
          <InstanceStateBadge {messages} state={instance.status as IncusStatusLit} />
          <Badge variant="outline" size="sm">
            <span data-slot="instance-detail-type">{typeLabel}</span>
          </Badge>
          {#if running}
            <Badge variant="success" size="sm">
              <span data-slot="instance-detail-running">●</span>
            </Badge>
          {/if}
        </div>
        <CardDescription>
          <span class="font-mono text-xs" data-slot="instance-detail-image">{instance.image}</span>
        </CardDescription>
      </div>
    </div>
  </Card>

  <!-- Action bar -->
  <Card>
    <CardHeader>
      <CardTitle>{actionsTitle}</CardTitle>
      <CardDescription>{actionsDesc}</CardDescription>
    </CardHeader>
    <CardBody>
      <InstanceActionBar
        {messages}
        canAct={canAct}
        {onAction}
        {pending}
      />
    </CardBody>
  </Card>

  <!-- Fields -->
  <Card>
    <CardHeader>
      <CardTitle>{fieldsTitle}</CardTitle>
      <CardDescription>{fieldsDesc}</CardDescription>
    </CardHeader>
    <CardBody>
      <dl class="grid grid-cols-1 gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
        <div class="flex flex-col gap-1">
          <dt class="text-xs uppercase tracking-wide text-muted-foreground">{fieldName}</dt>
          <dd class="font-mono text-xs" data-slot="instance-field-name">{instance.name}</dd>
        </div>
        <div class="flex flex-col gap-1">
          <dt class="text-xs uppercase tracking-wide text-muted-foreground">{fieldType}</dt>
          <dd data-slot="instance-field-type">{typeLabel}</dd>
        </div>
        <div class="flex flex-col gap-1">
          <dt class="text-xs uppercase tracking-wide text-muted-foreground">{fieldImage}</dt>
          <dd class="font-mono text-xs" data-slot="instance-field-image">{instance.image}</dd>
        </div>
        <div class="flex flex-col gap-1">
          <dt class="text-xs uppercase tracking-wide text-muted-foreground">{fieldCpu}</dt>
          <dd data-slot="instance-field-cpu">{cpu}</dd>
        </div>
        <div class="flex flex-col gap-1">
          <dt class="text-xs uppercase tracking-wide text-muted-foreground">{fieldMemory}</dt>
          <dd data-slot="instance-field-memory">{memory}</dd>
        </div>
        <div class="flex flex-col gap-1">
          <dt class="text-xs uppercase tracking-wide text-muted-foreground">{fieldCreated}</dt>
          <dd data-slot="instance-field-created">{instance.createdAt}</dd>
        </div>
        <div class="flex flex-col gap-1">
          <dt class="text-xs uppercase tracking-wide text-muted-foreground">{fieldBranch}</dt>
          <dd data-slot="instance-field-branch">{instance.config.target.branch}</dd>
        </div>
        <div class="flex flex-col gap-1">
          <dt class="text-xs uppercase tracking-wide text-muted-foreground">{fieldPool}</dt>
          <dd data-slot="instance-field-pool">{instance.config.image.pool}</dd>
        </div>
        <div class="flex flex-col gap-1">
          <dt class="text-xs uppercase tracking-wide text-muted-foreground">{fieldBridge}</dt>
          <dd data-slot="instance-field-bridge">{instance.config.network.bridge}</dd>
        </div>
        <div class="flex flex-col gap-1">
          <dt class="text-xs uppercase tracking-wide text-muted-foreground">{fieldTailscale}</dt>
          <dd data-slot="instance-field-tailscale">{instance.config.network.tailscale ? 'true' : 'false'}</dd>
        </div>
        <div class="flex flex-col gap-1 sm:col-span-2">
          <dt class="text-xs uppercase tracking-wide text-muted-foreground">{fieldHermes}</dt>
          <dd data-slot="instance-field-hermes">
            {instance.config.hermes.enabled
              ? `enabled · profile=${instance.config.hermes.profile ?? '—'} · port=${instance.config.hermes.port ?? '—'}`
              : 'disabled'}
          </dd>
        </div>
      </dl>
    </CardBody>
  </Card>

  <!-- Devices -->
  <Card>
    <CardHeader>
      <CardTitle>{devicesTitle}</CardTitle>
    </CardHeader>
    <CardBody>
      {#if Object.keys(instance.devices).length === 0}
        <p class="text-sm text-muted-foreground" data-slot="instance-devices-empty">
          {devicesEmpty}
        </p>
      {:else}
        <pre
          class="overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-xs"
          data-slot="instance-devices">{JSON.stringify(instance.devices, null, 2)}</pre>
      {/if}
    </CardBody>
  </Card>

  <!-- Validation -->
  <Card>
    <CardHeader>
      <CardTitle>{validationTitle}</CardTitle>
    </CardHeader>
    <CardBody>
      {#if instance.lastValidation == null}
        <p class="text-sm text-muted-foreground" data-slot="instance-validation-empty">
          {validationEmpty}
        </p>
      {:else}
        <pre
          class="overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-xs"
          data-slot="instance-validation">{JSON.stringify(instance.lastValidation, null, 2)}</pre>
      {/if}
    </CardBody>
  </Card>
</div>
