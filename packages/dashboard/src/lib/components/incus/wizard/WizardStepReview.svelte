<!--
  WizardStepReview — fifth step of the Incus creation wizard.

  Renders a read-only summary of the configured `IncusInstanceConfig`
  + the preflight report + a "Launch" button. The wizard page
  wires the launch action.

  i18n: every visible string routes through `t(messages, 'incus.wizard.review.*')`.
-->
<script lang="ts">
  import type { IncusInstanceConfig, IncusPreflightReport } from '@cortexos/contracts';
  import { t, type Messages } from '$lib/i18n';
  import Card from '$lib/components/ui/card/Card.svelte';
  import CardHeader from '$lib/components/ui/card/CardHeader.svelte';
  import CardTitle from '$lib/components/ui/card/CardTitle.svelte';
  import CardDescription from '$lib/components/ui/card/CardDescription.svelte';
  import CardBody from '$lib/components/ui/card/CardBody.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import PreflightReport from '../PreflightReport.svelte';

  type Props = {
    /** The wizard's accumulated config. */
    config: IncusInstanceConfig;
    /** The preflight report (or null if not yet run). */
    preflight: IncusPreflightReport | null;
    /** Whether a launch is currently in flight. */
    launching: boolean;
    /** Locale messages (from the root layout's PageData). */
    messages: Messages;
    /** Launch click handler. */
    onLaunch: () => void;
    /** Optional className passthrough. */
    class?: string;
  };

  let { config, preflight, launching, messages, onLaunch, class: className }: Props = $props();

  const title = $derived(t(messages, 'incus.wizard.review.title'));
  const description = $derived(t(messages, 'incus.wizard.review.description'));
  const launchLabel = $derived(t(messages, 'incus.wizard.review.launch'));
  const launchingLabel = $derived(t(messages, 'incus.wizard.review.launching'));
  const summaryTitle = $derived(t(messages, 'incus.wizard.review.summary'));
  const preflightTitle = $derived(t(messages, 'incus.wizard.review.preflightTitle'));
  const labelSlug = $derived(t(messages, 'incus.wizard.review.slug'));
  const labelImage = $derived(t(messages, 'incus.wizard.review.image'));
  const labelPool = $derived(t(messages, 'incus.wizard.review.pool'));
  const labelBridge = $derived(t(messages, 'incus.wizard.review.bridge'));
  const labelHermes = $derived(t(messages, 'incus.wizard.review.hermes'));
  const labelBranch = $derived(t(messages, 'incus.wizard.review.branch'));
</script>

<div data-slot="wizard-step-review" class={`flex flex-col gap-4 ${className ?? ''}`}>
  <div>
    <h2 class="text-lg font-semibold">{title}</h2>
    <p class="text-sm text-muted-foreground">{description}</p>
  </div>

  <Card>
    <CardHeader>
      <CardTitle>{summaryTitle}</CardTitle>
    </CardHeader>
    <CardBody>
      <dl class="grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
        <div class="flex justify-between gap-3">
          <dt class="text-muted-foreground">{labelSlug}</dt>
          <dd class="font-mono text-xs" data-slot="review-slug">{config.target.slug}</dd>
        </div>
        <div class="flex justify-between gap-3">
          <dt class="text-muted-foreground">{labelImage}</dt>
          <dd class="font-mono text-xs" data-slot="review-image">{config.image.alias}</dd>
        </div>
        <div class="flex justify-between gap-3">
          <dt class="text-muted-foreground">{labelPool}</dt>
          <dd class="font-mono text-xs" data-slot="review-pool">{config.image.pool}</dd>
        </div>
        <div class="flex justify-between gap-3">
          <dt class="text-muted-foreground">{labelBridge}</dt>
          <dd class="font-mono text-xs" data-slot="review-bridge">{config.network.bridge}</dd>
        </div>
        <div class="flex justify-between gap-3">
          <dt class="text-muted-foreground">{labelBranch}</dt>
          <dd class="font-mono text-xs" data-slot="review-branch">{config.target.branch}</dd>
        </div>
        <div class="flex justify-between gap-3 sm:col-span-2">
          <dt class="text-muted-foreground">{labelHermes}</dt>
          <dd class="font-mono text-xs" data-slot="review-hermes">
            {config.hermes.enabled
              ? `enabled · profile=${config.hermes.profile} · port=${config.hermes.port} · model=${config.hermes.model}`
              : 'disabled'}
          </dd>
        </div>
      </dl>
    </CardBody>
  </Card>

  <div>
    <h3 class="mb-2 text-sm font-medium">{preflightTitle}</h3>
    {#if preflight}
      <PreflightReport {messages} report={preflight} />
    {:else}
      <Card>
        <CardHeader>
          <CardTitle>{preflightTitle}</CardTitle>
          <CardDescription>—</CardDescription>
        </CardHeader>
      </Card>
    {/if}
  </div>

  <div class="flex items-center justify-end">
    <Button
      type="button"
      variant="default"
      size="sm"
      disabled={launching || preflight == null || !preflight.ok}
      onclick={onLaunch}
      ariaLabel={launching ? launchingLabel : launchLabel}
    >
      {launching ? launchingLabel : launchLabel}
    </Button>
  </div>
</div>
