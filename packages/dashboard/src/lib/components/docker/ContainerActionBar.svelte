<!--
  ContainerActionBar — the lifecycle action bar for a single
  container. Wires start / stop / restart / remove form actions
  on the detail page (PB-5: every destructive op requires an
  approval token that the page mints via the approval module).

  Each button is a real `<button type="submit" formaction="?/start">`
  inside the surrounding <form> on the detail page, so the form
  action path is the single source of truth for the dispatch.

  We use native <button> elements (not the design-system Button
  component) because the form's per-button `formaction` attribute
  is the dispatch mechanism and Button.svelte does not accept
  arbitrary attributes via $$restProps. The classes below mirror
  the design-system button so the visual contract is identical.

  i18n: every visible string (button label, aria-label, loading
  copy) routes through t(messages, 'docker.actions.*').
-->
<script lang="ts">
  import type { DockerContainer } from '@cortexos/contracts';
  import { t, type Messages } from '$lib/i18n';
  import { cn } from '$lib/utils/cn';
  import type { ContainerStateLit } from './adapter';

  type Props = {
    /** The container this action bar drives. */
    container: DockerContainer;
    /** Locale messages (from the root layout's PageData). */
    messages: Messages;
    /** Whether the start action is in flight. */
    starting?: boolean;
    /** Whether the stop action is in flight. */
    stopping?: boolean;
    /** Whether the restart action is in flight. */
    restarting?: boolean;
    /** Whether the remove action is in flight. */
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

  // A running container can be stopped / restarted / removed.
  // An exited / paused / restarting / created container can be
  // started / removed.
  const canStart = $derived.by(() => {
    const s = container.state as ContainerStateLit;
    return s === 'exited' || s === 'created' || s === 'paused' || s === 'dead';
  });
  const canStop = $derived(container.state === 'running');
  const canRestart = $derived(container.state === 'running' || container.state === 'paused');

  const startLabel = $derived(t(messages, 'docker.actions.start'));
  const stopLabel = $derived(t(messages, 'docker.actions.stop'));
  const restartLabel = $derived(t(messages, 'docker.actions.restart'));
  const removeLabel = $derived(t(messages, 'docker.actions.remove'));
  const startLoadingLabel = $derived(t(messages, 'docker.actions.starting'));
  const stopLoadingLabel = $derived(t(messages, 'docker.actions.stopping'));
  const restartLoadingLabel = $derived(t(messages, 'docker.actions.restarting'));
  const removeLoadingLabel = $derived(t(messages, 'docker.actions.removing'));

  const regionLabel = $derived(t(messages, 'docker.actions.regionLabel'));

  // Style helpers — mirror the design-system Button classes so the
  // visual contract is identical. We use a `cn()` join for the
  // base + variant + size concatenation.
  const base =
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium ' +
    'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ' +
    'focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none ' +
    'disabled:opacity-50 select-none cursor-pointer';
  const size = 'h-9 px-4 text-sm';
  const variants = {
    default: 'bg-primary text-primary-foreground hover:bg-primary/90',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
    outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
    destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
  } as const;
</script>

<div
  data-slot="container-action-bar"
  data-container-id={container.id}
  class={`flex flex-wrap items-center gap-2 ${className ?? ''}`}
  role="group"
  aria-label={regionLabel}
>
  {#if canStart}
    <button
      type="submit"
      formaction="?/start"
      disabled={starting}
      aria-busy={starting}
      aria-label={startLabel}
      data-slot="container-action-start"
      class={cn(base, size, variants.default)}
    >
      {starting ? startLoadingLabel : startLabel}
    </button>
  {/if}

  {#if canStop}
    <button
      type="submit"
      formaction="?/stop"
      disabled={stopping}
      aria-busy={stopping}
      aria-label={stopLabel}
      data-slot="container-action-stop"
      class={cn(base, size, variants.secondary)}
    >
      {stopping ? stopLoadingLabel : stopLabel}
    </button>
  {/if}

  {#if canRestart}
    <button
      type="submit"
      formaction="?/restart"
      disabled={restarting}
      aria-busy={restarting}
      aria-label={restartLabel}
      data-slot="container-action-restart"
      class={cn(base, size, variants.outline)}
    >
      {restarting ? restartLoadingLabel : restartLabel}
    </button>
  {/if}

  <button
    type="submit"
    formaction="?/remove"
    disabled={removing}
    aria-busy={removing}
    aria-label={removeLabel}
    data-slot="container-action-remove"
    class={cn(base, size, variants.destructive)}
  >
    {removing ? removeLoadingLabel : removeLabel}
  </button>
</div>
