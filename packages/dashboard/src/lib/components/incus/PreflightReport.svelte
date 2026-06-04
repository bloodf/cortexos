<!--
  PreflightReport — read-only render of an `IncusPreflightReport`.

  Used by the wizard's review step to show the user the preflight
  result before they click "Launch". The component takes the
  report and the i18n `Messages`, and renders one row per check
  (label + pass/fail badge + optional detail).

  i18n: every visible string routes through `t(messages, 'incus.preflight.*')`.
-->
<script lang="ts">
  import type { IncusPreflightReport } from '@cortexos/contracts';
  import { t, type Messages } from '$lib/i18n';
  import Card from '$lib/components/ui/card/Card.svelte';
  import CardHeader from '$lib/components/ui/card/CardHeader.svelte';
  import CardTitle from '$lib/components/ui/card/CardTitle.svelte';
  import CardDescription from '$lib/components/ui/card/CardDescription.svelte';
  import CardBody from '$lib/components/ui/card/CardBody.svelte';
  import Badge from '$lib/components/ui/badge/Badge.svelte';

  type Props = {
    /** The preflight report. */
    report: IncusPreflightReport;
    /** Locale messages (from the root layout's PageData). */
    messages: Messages;
    /** Optional className passthrough. */
    class?: string;
  };

  let { report, messages, class: className }: Props = $props();

  const title = $derived(t(messages, 'incus.preflight.title'));
  const description = $derived(t(messages, 'incus.preflight.description'));
  const passLabel = $derived(t(messages, 'incus.preflight.pass'));
  const failLabel = $derived(t(messages, 'incus.preflight.fail'));
  const emptyLabel = $derived(t(messages, 'incus.preflight.empty'));
  const okBanner = $derived(t(messages, 'incus.preflight.ok'));
  const failBanner = $derived(t(messages, 'incus.preflight.notOk'));
</script>

<Card class={className}>
  <CardHeader>
    <CardTitle>{title}</CardTitle>
    <CardDescription>{description}</CardDescription>
  </CardHeader>
  <CardBody>
    <div
      data-slot="preflight-banner"
      data-ok={String(report.ok)}
      class={`mb-3 rounded-md border px-3 py-2 text-sm ${
        report.ok
          ? 'border-success/30 bg-success/10 text-success'
          : 'border-destructive/30 bg-destructive/10 text-destructive'
      }`}
    >
      {report.ok ? okBanner : failBanner}
    </div>
    {#if report.checks.length === 0}
      <p class="text-sm text-muted-foreground" data-slot="preflight-empty">
        {emptyLabel}
      </p>
    {:else}
      <ul class="flex flex-col gap-2" data-slot="preflight-checks">
        {#each report.checks as check (check.id)}
          <li
            class="flex items-start justify-between gap-3 rounded-md border border-border px-3 py-2"
            data-slot="preflight-check"
            data-check-id={check.id}
            data-pass={String(check.pass)}
          >
            <div class="flex-1">
              <div class="text-sm font-medium">{check.label}</div>
              {#if check.detail}
                <div class="font-mono text-xs text-muted-foreground">{check.detail}</div>
              {/if}
            </div>
            <Badge variant={check.pass ? 'success' : 'destructive'} size="sm">
              <span data-slot="preflight-check-result">
                {check.pass ? passLabel : failLabel}
              </span>
            </Badge>
          </li>
        {/each}
      </ul>
    {/if}
  </CardBody>
</Card>
