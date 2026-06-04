<!--
  /incus/wizard — multi-step create wizard.

  5 steps (image → instance → network → profile → review). Step
  state is client-side (the page's `current` index). The review
  step runs the preflight via the `?/preflight` form action and
  renders the result. The "Launch" button calls `?/launch`.

  i18n: every visible string routes through `t(data.messages, 'incus.wizard.*')`.
-->
<script lang="ts">
  import type { PageData, ActionData } from './$types';
  import { goto } from '$app/navigation';
  import { t } from '$lib/i18n';
  import type { IncusInstanceConfig, IncusPreflightReport } from '@cortexos/contracts';
  import type { IncusTypeLit } from '$lib/components/incus/adapter';
  import WizardStepper from '$lib/components/incus/wizard/WizardStepper.svelte';
  import WizardStepImage from '$lib/components/incus/wizard/WizardStepImage.svelte';
  import WizardStepInstance from '$lib/components/incus/wizard/WizardStepInstance.svelte';
  import WizardStepNetwork from '$lib/components/incus/wizard/WizardStepNetwork.svelte';
  import WizardStepProfile from '$lib/components/incus/wizard/WizardStepProfile.svelte';
  import WizardStepReview from '$lib/components/incus/wizard/WizardStepReview.svelte';
  import Button from '$lib/components/ui/Button.svelte';

  interface Props {
    data: PageData;
    form: ActionData;
  }

  let { data, form }: Props = $props();

  // svelte-ignore state_referenced_locally
  let current = $state<number>(0);
  // svelte-ignore state_referenced_locally
  let config = $state<IncusInstanceConfig>({ ...data.defaultConfig });
  // svelte-ignore state_referenced_locally
  let preflight = $state<IncusPreflightReport | null>(null);
  let launching = $state<boolean>(false);

  // Pre-compute the step list (i18n-resolved) so the stepper stays
  // in sync with the current locale.
  const steps = $derived([
    { key: 'image', label: t(data.messages, 'incus.wizard.steps.image') },
    { key: 'instance', label: t(data.messages, 'incus.wizard.steps.instance') },
    { key: 'network', label: t(data.messages, 'incus.wizard.steps.network') },
    { key: 'profile', label: t(data.messages, 'incus.wizard.steps.profile') },
    { key: 'review', label: t(data.messages, 'incus.wizard.steps.review') },
  ]);

  const backLabel = $derived(t(data.messages, 'incus.wizard.back'));
  const nextLabel = $derived(t(data.messages, 'incus.wizard.next'));
  const runPreflightLabel = $derived(t(data.messages, 'incus.wizard.runPreflight'));

  // The slug mirrors config.target.slug. We track it as a
  // local mirror so the instance step can update it on the fly.
  function setSlug(next: string): void {
    config = { ...config, target: { ...config.target, slug: next } };
  }
  void setSlug;

  function setImageAlias(next: string): void {
    config = {
      ...config,
      image: { ...config.image, alias: next },
    };
  }

  function setGastown(next: boolean): void {
    config = {
      ...config,
      image: { ...config.image, gastown: next },
    };
  }

  function setInstanceType(next: IncusTypeLit): void {
    // No-op in the contract (type comes from the launch); but
    // we keep the mirror so the wizard state is self-describing.
    void next;
  }

  function setPool(next: string): void {
    config = { ...config, image: { ...config.image, pool: next } };
  }

  function setCpu(next: number): void {
    config = { ...config, image: { ...config.image, cpu: next } };
  }

  function setMemory(next: number): void {
    config = { ...config, image: { ...config.image, memory: next } };
  }

  function setBridge(next: string): void {
    config = { ...config, network: { ...config.network, bridge: next } };
  }

  function setTailscale(next: boolean): void {
    config = { ...config, network: { ...config.network, tailscale: next } };
  }

  function setWebAccess(next: boolean): void {
    config = { ...config, network: { ...config.network, webAccess: next } };
  }

  function setHermesEnabled(next: boolean): void {
    config = { ...config, hermes: { ...config.hermes, enabled: next } };
  }

  function setHermesProfile(next: string): void {
    config = { ...config, hermes: { ...config.hermes, profile: next } };
  }

  function setHermesPort(next: number): void {
    config = { ...config, hermes: { ...config.hermes, port: next } };
  }

  function setHermesModel(next: string): void {
    config = { ...config, hermes: { ...config.hermes, model: next } };
  }

  function canAdvance(): boolean {
    switch (current) {
      case 0:
        return config.image.alias.length > 0;
      case 1:
        return /^[a-z][a-z0-9-]{0,62}[a-z0-9]$/.test(config.target.slug);
      case 2:
        return config.network.bridge.length > 0;
      case 3:
        return !config.hermes.enabled || (config.hermes.profile !== undefined && config.hermes.profile.length > 0 && (config.hermes.port ?? 0) > 0);
      case 4:
        return preflight?.ok === true;
      default:
        return false;
    }
  }

  function next(): void {
    if (current < 4 && canAdvance()) current += 1;
  }

  function back(): void {
    if (current > 0) current -= 1;
  }

  async function runPreflight(): Promise<void> {
    const fd = new FormData();
    fd.set('config', JSON.stringify(config));
    const res = await fetch('?/preflight', { method: 'POST', body: fd });
    const body = (await res.json()) as
      | { type: 'success'; data: { report?: IncusPreflightReport } }
      | { type: 'failure'; data?: { error?: string } };
    if (body.type === 'success' && body.data.report) {
      preflight = body.data.report;
    }
  }

  async function launch(): Promise<void> {
    if (launching) return;
    launching = true;
    try {
      const fd = new FormData();
      fd.set('config', JSON.stringify(config));
      const res = await fetch('?/launch', { method: 'POST', body: fd });
      const body = (await res.json()) as
        | { type: 'success'; data: { name?: string } }
        | { type: 'failure'; data?: { error?: string } };
      if (body.type === 'success' && body.data.name) {
        await goto(`/incus/${encodeURIComponent(body.data.name)}`);
      }
    } finally {
      setTimeout(() => {
        launching = false;
      }, 800);
    }
  }

  // Run preflight automatically when entering the review step.
  $effect(() => {
    if (current === 4 && preflight == null) {
      void runPreflight();
    }
  });

  // Re-run preflight when the user comes back to the review step
  // and the config has changed.
  $effect(() => {
    if (current === 4 && form == null) {
      void runPreflight();
    }
  });

  // Status filter type re-import (avoids the dead-import lint).
  void (null as unknown as IncusTypeLit);
</script>

<svelte:head>
  <title>{t(data.messages, 'incus.wizard.title')} · CortexOS</title>
</svelte:head>

<div class="flex flex-col gap-6">
  <div>
    <h1 class="text-2xl font-semibold">{t(data.messages, 'incus.wizard.title')}</h1>
    <p class="text-sm text-muted-foreground">
      {t(data.messages, 'incus.wizard.description')}
    </p>
  </div>

  <WizardStepper {steps} current={current} messages={data.messages} />

  <div class="rounded-md border border-border bg-card p-4">
    {#if current === 0}
      <WizardStepImage
        messages={data.messages}
        alias={config.image.alias}
        gastown={config.image.gastown}
        aliases={data.aliases}
        onAliasChange={setImageAlias}
        onGastownChange={setGastown}
      />
    {:else if current === 1}
      <WizardStepInstance
        messages={data.messages}
        name={config.target.slug}
        type={'container' as IncusTypeLit}
        pool={config.image.pool ?? 'default'}
        cpu={config.image.cpu ?? 2}
        memory={config.image.memory ?? 1024}
        pools={data.pools}
        onNameChange={setSlug}
        onTypeChange={setInstanceType}
        onPoolChange={setPool}
        onCpuChange={setCpu}
        onMemoryChange={setMemory}
      />
    {:else if current === 2}
      <WizardStepNetwork
        messages={data.messages}
        bridge={config.network.bridge}
        tailscale={config.network.tailscale}
        webAccess={config.network.webAccess}
        bridges={data.bridges}
        onBridgeChange={setBridge}
        onTailscaleChange={setTailscale}
        onWebAccessChange={setWebAccess}
      />
    {:else if current === 3}
      <WizardStepProfile
        messages={data.messages}
        hermesEnabled={config.hermes.enabled}
        hermesProfile={config.hermes.profile ?? 'hermes'}
        hermesPort={config.hermes.port ?? 18695}
        hermesModel={config.hermes.model ?? 'gpt-4o-mini'}
        onHermesEnabledChange={setHermesEnabled}
        onHermesProfileChange={setHermesProfile}
        onHermesPortChange={setHermesPort}
        onHermesModelChange={setHermesModel}
      />
    {:else}
      <WizardStepReview
        messages={data.messages}
        {config}
        {preflight}
        {launching}
        onLaunch={launch}
      />
      <div class="mt-3 flex justify-end">
        <Button size="sm" variant="outline" onclick={runPreflight}>
          {runPreflightLabel}
        </Button>
      </div>
    {/if}
  </div>

  <div class="flex items-center justify-between">
    <Button size="sm" variant="outline" disabled={current === 0} onclick={back}>
      {backLabel}
    </Button>
    {#if current < 4}
      <span data-slot="wizard-next">
        <Button
          size="sm"
          variant="default"
          disabled={!canAdvance()}
          onclick={next}
        >
          {nextLabel}
        </Button>
      </span>
    {/if}
  </div>
</div>
