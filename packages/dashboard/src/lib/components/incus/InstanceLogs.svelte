<!--
  InstanceLogs — last-N log lines for an Incus instance.

  Renders a small table (newest first) of the instance's recent
  log lines. The component is purely presentational; the page
  loads the lines via `+page.server.ts` and passes them in.

  For live updates the page can switch to the
  `/incus/[name]/logs` endpoint (a `+server.ts` GET that returns
  the most recent lines as JSON). Today this component is the
  static path.

  i18n: every visible string routes through `t(messages, 'incus.logs.*')`.
-->
<script lang="ts">
  import type { IncusLogLine } from '$lib/server/incus/bridge';
  import { t, type Messages } from '$lib/i18n';
  import Card from '$lib/components/ui/card/Card.svelte';
  import CardHeader from '$lib/components/ui/card/CardHeader.svelte';
  import CardTitle from '$lib/components/ui/card/CardTitle.svelte';
  import CardDescription from '$lib/components/ui/card/CardDescription.svelte';
  import CardBody from '$lib/components/ui/card/CardBody.svelte';
  import { formatLogLine } from './adapter';

  type Props = {
    /** Log lines, newest first. */
    logs: readonly IncusLogLine[];
    /** Locale messages (from the root layout's PageData). */
    messages: Messages;
    /** Section title (i18n-resolved by the parent). */
    title: string;
    /** Section description (i18n-resolved by the parent). */
    description: string;
    /** Empty-state label (i18n-resolved by the parent). */
    emptyLabel: string;
    /** Optional className passthrough. */
    class?: string;
  };

  let { logs, messages, title, description, emptyLabel, class: className }: Props = $props();

  const colWhen = $derived(t(messages, 'incus.table.timestamp'));
  const colPriority = $derived(t(messages, 'incus.table.priority'));
  const colMessage = $derived(t(messages, 'incus.table.message'));
</script>

<Card class={className}>
  <CardHeader>
    <CardTitle>{title}</CardTitle>
    <CardDescription>{description}</CardDescription>
  </CardHeader>
  <CardBody>
    {#if logs.length === 0}
      <p class="text-sm text-muted-foreground" data-slot="instance-logs-empty">
        {emptyLabel}
      </p>
    {:else}
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b text-left text-xs uppercase text-muted-foreground">
              <th class="py-2 pr-4 font-medium">{colWhen}</th>
              <th class="py-2 pr-4 font-medium">{colPriority}</th>
              <th class="py-2 font-medium">{colMessage}</th>
            </tr>
          </thead>
          <tbody>
            {#each logs as line, i (i)}
              <tr
                class="border-b last:border-b-0"
                data-slot="instance-logs-row"
                data-priority={line.priority}
              >
                <td class="py-2 pr-4 font-mono text-xs">{line.ts}</td>
                <td class="py-2 pr-4 text-xs uppercase text-muted-foreground">
                  {line.priority}
                </td>
                <td class="py-2">{formatLogLine(line)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </CardBody>
</Card>
