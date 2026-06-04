<!--
  InstanceExecNamed — PB-4 named-exec form for an Incus instance.

  Replaces the legacy /shell arbitrary-exec form. Renders a select
  for the closed set of allowlisted shell ops + an args input +
  a Submit button. The component is presentational; submission
  happens via fetch to /api/incus/[name]/exec-named.

  Every op in the dropdown is from the bridge's EXEC_NAMED_OPS
  allowlist. No `bash -c <userstring>` is ever accepted (SR-019).

  i18n: every visible string routes through `t(messages, 'incus.exec.*')`.
-->
<script lang="ts">
  import { t, type Messages } from '$lib/i18n';
  import Select from '$lib/components/ui/Select.svelte';
  import Input from '$lib/components/ui/Input.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Card from '$lib/components/ui/card/Card.svelte';
  import CardHeader from '$lib/components/ui/card/CardHeader.svelte';
  import CardTitle from '$lib/components/ui/card/CardTitle.svelte';
  import CardDescription from '$lib/components/ui/card/CardDescription.svelte';
  import CardBody from '$lib/components/ui/card/CardBody.svelte';
  import type { IncusShellOp } from '@cortexos/contracts';

  type Props = {
    /** The instance name (shown in the form description). */
    instanceName: string;
    /** Locale messages (from the root layout's PageData). */
    messages: Messages;
    /** Whether the current user is an admin (PB-4). */
    isAdmin: boolean;
    /** Optional className passthrough. */
    class?: string;
  };

  let { instanceName, messages, isAdmin, class: className }: Props = $props();

  // The closed set of allowlisted shell ops, mirrored from
  // `$lib/server/incus/bridge.ts` `EXEC_NAMED_OPS`. Kept in sync
  // by the bridge's tests. We use the type-only import here so
  // the contracts barrel (which transitively pulls in node:crypto
  // via audit.js) does not get bundled for the browser.
  const ops: IncusShellOp[] = [
    'term.ps',
    'term.df',
    'term.ls',
    'term.cat',
    'term.tail_log',
    'term.exec_named',
  ];

  let op = $state<IncusShellOp>('term.ps');
  let path = $state<string>('/');
  let n = $state<number>(10);
  let unit = $state<string>('sshd');
  let command = $state<string>('uptime');
  let output = $state<string>('');
  let submitting = $state<boolean>(false);
  let lastError = $state<string | null>(null);

  const title = $derived(t(messages, 'incus.exec.title'));
  const description = $derived(
    t(messages, 'incus.exec.description').replace('{name}', instanceName),
  );
  const help = $derived(t(messages, 'incus.exec.help'));
  const submit = $derived(t(messages, 'incus.exec.submit'));
  const submittingLabel = $derived(t(messages, 'incus.exec.submitting'));
  const outputTitle = $derived(t(messages, 'incus.exec.output'));
  const adminOnlyLabel = $derived(t(messages, 'incus.exec.adminOnly'));
  const opLabel = $derived(t(messages, 'incus.exec.opLabel'));
  const pathLabel = $derived(t(messages, 'incus.exec.pathLabel'));
  const nLabel = $derived(t(messages, 'incus.exec.nLabel'));
  const unitLabel = $derived(t(messages, 'incus.exec.unitLabel'));
  const commandLabel = $derived(t(messages, 'incus.exec.commandLabel'));

  function buildArgs(): Readonly<Record<string, unknown>> {
    switch (op) {
      case 'term.ls':
        return { path };
      case 'term.cat':
        return { path };
      case 'term.tail_log':
        return { unit, n };
      case 'term.exec_named':
        return { command };
      default:
        return {};
    }
  }

  async function handleSubmit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (!isAdmin) {
      lastError = adminOnlyLabel;
      return;
    }
    if (submitting) return;
    submitting = true;
    lastError = null;
    output = '';
    try {
      const res = await fetch(`/api/incus/${encodeURIComponent(instanceName)}/exec-named`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ op, args: buildArgs() }),
      });
      const body = (await res.json()) as
        | { status: 'accepted'; stdout: string; stderr: string; exitCode: number }
        | { status: 'rejected'; reason: string; code: string };
      if (body.status === 'accepted') {
        output = body.stdout;
      } else {
        lastError = body.reason;
        output = '';
      }
    } catch (e) {
      lastError = (e as Error).message;
    } finally {
      submitting = false;
    }
  }
</script>

<Card class={className}>
  <CardHeader>
    <CardTitle>{title}</CardTitle>
    <CardDescription>{description}</CardDescription>
  </CardHeader>
  <CardBody>
    <form
      method="POST"
      onsubmit={handleSubmit}
      data-slot="instance-exec-named"
      class="flex flex-col gap-3"
    >
      <div>
        <label for="instance-exec-op" class="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">
          {opLabel}
        </label>
        <Select
          id="instance-exec-op"
          value={op}
          options={ops.map((o) => ({ value: o, label: o }))}
          onchange={(e) => (op = (e.currentTarget as HTMLSelectElement).value as IncusShellOp)}
          disabled={!isAdmin || submitting}
        />
      </div>
      {#if op === 'term.ls' || op === 'term.cat'}
        <div>
          <label for="instance-exec-path" class="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">
            {pathLabel}
          </label>
          <Input
            id="instance-exec-path"
            type="text"
            value={path}
            oninput={(e) => (path = (e.currentTarget as HTMLInputElement).value)}
            disabled={!isAdmin || submitting}
          />
        </div>
      {/if}
      {#if op === 'term.tail_log'}
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="instance-exec-unit" class="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">
              {unitLabel}
            </label>
            <Input
              id="instance-exec-unit"
              type="text"
              value={unit}
              oninput={(e) => (unit = (e.currentTarget as HTMLInputElement).value)}
              disabled={!isAdmin || submitting}
            />
          </div>
          <div>
            <label for="instance-exec-n" class="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">
              {nLabel}
            </label>
          <Input
            id="instance-exec-n"
            type="number"
            value={String(n)}
            oninput={(e) => (n = Number((e.currentTarget as HTMLInputElement).value))}
            disabled={!isAdmin || submitting}
          />
          </div>
        </div>
      {/if}
      {#if op === 'term.exec_named'}
        <div>
          <label for="instance-exec-command" class="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">
            {commandLabel}
          </label>
          <Input
            id="instance-exec-command"
            type="text"
            value={command}
            oninput={(e) => (command = (e.currentTarget as HTMLInputElement).value)}
            disabled={!isAdmin || submitting}
          />
        </div>
      {/if}
      <div class="flex items-center justify-between gap-2">
        <p class="text-xs text-muted-foreground" data-slot="instance-exec-help">{help}</p>
        <Button
          type="submit"
          size="sm"
          disabled={!isAdmin || submitting}
          ariaLabel={submitting ? submittingLabel : submit}
        >
          {submitting ? submittingLabel : submit}
        </Button>
      </div>
      {#if !isAdmin}
        <p class="text-xs text-destructive" data-slot="instance-exec-admin-only">{adminOnlyLabel}</p>
      {/if}
      {#if lastError}
        <p class="text-xs text-destructive" data-slot="instance-exec-error">{lastError}</p>
      {/if}
    </form>
    {#if output}
      <div class="mt-4">
        <h3 class="mb-2 text-sm font-medium" data-slot="instance-exec-output-title">{outputTitle}</h3>
        <pre
          class="overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-xs"
          data-slot="instance-exec-output">{output}</pre>
      </div>
    {/if}
  </CardBody>
</Card>
