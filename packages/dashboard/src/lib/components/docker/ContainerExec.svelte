<!--
  ContainerExec — admin-only allowlisted exec form. PB-5: every
  submission requires a valid approval token (the parent page
  mints the token via the approval module's `mintApproval`). PB-2
  / SR-019: the form rejects any `bash -c <userstring>` at both
  the route layer AND the bridge layer (defence in depth).

  Allowed subcommand set is the same one the policy allowlist
  exposes for the `docker.exec` op — the route also enforces the
  allowlist server-side.

  i18n: every visible string (label, placeholder, submit, error)
  routes through t(messages, 'docker.exec.*').
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
    /** Approval token input value (the parent wires to a hidden field). */
    approvalToken: string;
    /** The available allowlisted subcommands (read-only). */
    allowedSubcommands: ReadonlyArray<{ value: string; label: string }>;
    /** Whether the form is currently submitting. */
    submitting?: boolean;
    /** Server-side error message (validation / approval rejection). */
    error?: string | null;
    /** Server-side success output (if any). */
    output?: string | null;
    /** Optional className passthrough. */
    class?: string;
  };

  let {
    container,
    messages,
    approvalToken,
    allowedSubcommands,
    submitting = false,
    error = null,
    output = null,
    class: className,
  }: Props = $props();

  const title = $derived(t(messages, 'docker.exec.title'));
  const description = $derived(
    t(messages, 'docker.exec.description').replace('{name}', container.name),
  );
  const subcommandLabel = $derived(t(messages, 'docker.exec.subcommand'));
  const submitLabel = $derived(t(messages, 'docker.exec.submit'));
  const submittingLabel = $derived(t(messages, 'docker.exec.submitting'));
  const outputLabel = $derived(t(messages, 'docker.exec.output'));
  const helpLabel = $derived(t(messages, 'docker.exec.help'));

  // Native <button> with the design-system Button (default, md)
  // classes. We do this because the form lives in the page (not
  // the component) and the page's wrapping <form> controls the
  // action; the submit button must be inside the form, not
  // portaled via the design-system Button component which would
  // drop our data-slot attribute.
  const btnBase =
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium ' +
    'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ' +
    'focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none ' +
    'disabled:opacity-50 select-none cursor-pointer';
  const btnSize = 'h-9 px-4 text-sm';
  const btnVariant = 'bg-primary text-primary-foreground hover:bg-primary/90';
</script>

<form
  method="POST"
  data-slot="container-exec-form"
  data-container-id={container.id}
  class={`flex flex-col gap-4 ${className ?? ''}`}
>
  <Card>
    <CardHeader>
      <CardTitle>{title}</CardTitle>
      <CardDescription>{description}</CardDescription>
    </CardHeader>
    <CardBody>
      {#if error}
        <div
          data-slot="container-exec-error"
          class="mb-3 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive"
          role="alert"
        >
          {error}
        </div>
      {/if}
      <p class="mb-3 text-xs text-muted-foreground">{helpLabel}</p>
      <div class="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label class="flex flex-1 flex-col gap-1">
          <span class="text-sm text-muted-foreground">{subcommandLabel}</span>
          <select
            name="subcommand"
            data-slot="container-exec-subcommand"
            class="rounded-md border border-input bg-background px-3 py-2 text-sm"
            required
          >
            {#each allowedSubcommands as opt (opt.value)}
              <option value={opt.value}>{opt.label}</option>
            {/each}
          </select>
        </label>
        <input type="hidden" name="approvalToken" value={approvalToken} />
        <button
          type="submit"
          disabled={submitting}
          aria-busy={submitting}
          aria-label={submitLabel}
          data-slot="container-exec-submit"
          class={cn(btnBase, btnSize, btnVariant)}
        >
          {submitting ? submittingLabel : submitLabel}
        </button>
      </div>
    </CardBody>
  </Card>

  {#if output}
    <Card>
      <CardHeader>
        <CardTitle>{outputLabel}</CardTitle>
      </CardHeader>
      <CardBody>
        <pre
          data-slot="container-exec-output"
          class="max-h-96 overflow-auto rounded-md bg-zinc-950 p-3 font-mono text-xs leading-relaxed text-zinc-100"
        >{output}</pre>
      </CardBody>
    </Card>
  {/if}
</form>
