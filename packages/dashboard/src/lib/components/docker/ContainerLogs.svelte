<!--
  ContainerLogs — read-only display of the last N log lines for a
  container. The actual fetch happens via the /docker/[id]/logs
  +server.ts endpoint; this component is the presentational surface.

  Props:
    - `container` — the container we're viewing logs for.
    - `messages` — locale messages.
    - `lines` — the log lines (the parent page or +page.server.ts
      provides these via tailLogs()).
    - `tail` — the requested tail count (shown in the header).
    - `loading` — whether a fetch is in flight.
    - `error` — an optional error message; rendered as a destructive
      banner.
    - `onRefresh` — fires when the user clicks the Refresh button.

  i18n: every visible string (title, description, empty, refresh)
  routes through t(messages, 'docker.logs.*').
-->
<script lang="ts">
  import type { DockerContainer } from '@cortexos/contracts';
  import { t, type Messages } from '$lib/i18n';
  import Card from '$lib/components/ui/card/Card.svelte';
  import CardHeader from '$lib/components/ui/card/CardHeader.svelte';
  import CardTitle from '$lib/components/ui/card/CardTitle.svelte';
  import CardDescription from '$lib/components/ui/card/CardDescription.svelte';
  import CardBody from '$lib/components/ui/card/CardBody.svelte';
  import { cn } from '$lib/utils/cn';

  type Props = {
    container: DockerContainer;
    messages: Messages;
    lines: ReadonlyArray<string>;
    tail: number;
    loading?: boolean;
    error?: string | null;
    onRefresh?: () => void;
    class?: string;
  };

  let {
    container,
    messages,
    lines,
    tail,
    loading = false,
    error = null,
    onRefresh,
    class: className,
  }: Props = $props();

  const title = $derived(t(messages, 'docker.logs.title'));
  const description = $derived(
    t(messages, 'docker.logs.description').replace('{name}', container.name),
  );
  const empty = $derived(t(messages, 'docker.logs.empty'));
  const refreshLabel = $derived(t(messages, 'docker.logs.refresh'));
  const tailLabel = $derived(t(messages, 'docker.logs.tail').replace('{n}', String(tail)));
  const countLabel = $derived(
    t(messages, 'docker.logs.lineCount').replace('{n}', String(lines.length)),
  );

  // Match the design-system Button (outline, sm) classes. We use
  // a native <button> so the data-slot attribute is preserved.
  const btnBase =
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium ' +
    'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ' +
    'focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none ' +
    'disabled:opacity-50 select-none cursor-pointer';
  const btnSize = 'h-8 px-3 text-sm';
  const btnVariant = 'border border-input bg-background hover:bg-accent hover:text-accent-foreground';
</script>

<Card class={className}>
  <CardHeader>
    <div class="flex flex-wrap items-start justify-between gap-2">
      <div class="min-w-0 flex-1">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </div>
      {#if onRefresh}
        <button
          type="button"
          onclick={onRefresh}
          disabled={loading}
          aria-busy={loading}
          aria-label={refreshLabel}
          data-slot="container-logs-refresh"
          class={cn(btnBase, btnSize, btnVariant)}
        >
          {refreshLabel}
        </button>
      {/if}
    </div>
  </CardHeader>
  <CardBody>
    {#if error}
      <div
        data-slot="container-logs-error"
        class="mb-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive"
        role="alert"
      >
        {error}
      </div>
    {/if}
    <p class="mb-2 text-xs text-muted-foreground">
      <span data-slot="container-logs-tail">{tailLabel}</span>
      <span class="ml-2" data-slot="container-logs-count">{countLabel}</span>
    </p>
    {#if lines.length === 0}
      <p
        data-slot="container-logs-empty"
        class="rounded-md border border-dashed border-border bg-card/50 p-4 text-center text-sm text-muted-foreground"
      >
        {empty}
      </p>
    {:else}
      <pre
        data-slot="container-logs-body"
        class="max-h-96 overflow-auto rounded-md bg-zinc-950 p-3 font-mono text-xs leading-relaxed text-zinc-100"
      >{lines.join('\n')}</pre>
    {/if}
  </CardBody>
</Card>
