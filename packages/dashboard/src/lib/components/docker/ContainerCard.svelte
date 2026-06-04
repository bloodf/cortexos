<!--
  ContainerCard — single docker container card built on the
  design-system Card.

  Used in the Docker overview (grid) and dashboard widgets. The
  card is non-interactive on its own; navigation is provided by
  passing an `onSelect` handler. This keeps the component reusable
  inside non-link surfaces.

  Required props are typed against @cortexos/contracts so misuse
  (e.g. passing a DockerContainer with a missing field) is a
  compile error at the call site.

  i18n: pass the locale `messages` map (from `$lib/i18n`) and every
  visible string routes through `t(messages, 'docker.*')`.
-->
<script lang="ts">
  import type { DockerContainer } from '@cortexos/contracts';
  import { t, type Messages } from '$lib/i18n';
  import Card from '$lib/components/ui/card/Card.svelte';
  import CardHeader from '$lib/components/ui/card/CardHeader.svelte';
  import CardTitle from '$lib/components/ui/card/CardTitle.svelte';
  import CardDescription from '$lib/components/ui/card/CardDescription.svelte';
  import CardBody from '$lib/components/ui/card/CardBody.svelte';
  import CardFooter from '$lib/components/ui/card/CardFooter.svelte';
  import ContainerStateBadge from './ContainerStateBadge.svelte';
  import type { ContainerStateLit } from './adapter';

  type Props = {
    /** The full container record. The component never mutates it. */
    container: DockerContainer;
    /** Locale messages (from the root layout's PageData). */
    messages: Messages;
    /** Optional click handler (e.g. `navigate('/docker/${id}')`). */
    onSelect?: (container: DockerContainer) => void;
    /** Optional className passthrough for layout grids. */
    class?: string;
  };

  let { container, messages, onSelect, class: className }: Props = $props();

  /** Icon monogram — first 1-2 characters of the name, upper-cased. */
  const monogram = $derived.by(() => {
    const n = container.name ?? '';
    const cleaned = n.replace(/[^a-z0-9]/gi, '');
    return cleaned.slice(0, 2).toUpperCase() || '?';
  });

  /** Pre-formatted port list, e.g. "3000:3000, 9090:9090" or "—". */
  const portsDisplay = $derived.by(() => {
    if (!container.ports || container.ports.length === 0) return '—';
    return container.ports.join(', ');
  });

  const ariaState = $derived(t(messages, 'docker.detail.fields.state'));
  const ariaImage = $derived(t(messages, 'docker.detail.fields.image'));
  const ariaPorts = $derived(t(messages, 'docker.detail.fields.ports'));

  function handleClick(): void {
    if (onSelect) onSelect(container);
  }

  function handleKey(event: KeyboardEvent): void {
    if (!onSelect) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(container);
    }
  }
</script>

<Card size="default" class={className}>
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div
    role={onSelect ? 'button' : undefined}
    tabindex={onSelect ? 0 : undefined}
    data-slot="container-card"
    data-container-id={container.id}
    data-container-name={container.name}
    onclick={handleClick}
    onkeydown={handleKey}
    class="flex h-full cursor-pointer flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  >
    <CardHeader>
      <div class="flex items-start gap-3">
        <div
          data-slot="container-icon"
          aria-hidden="true"
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
          style:background-color="#0ea5e9"
        >
          {monogram}
        </div>
        <div class="min-w-0 flex-1">
          <CardTitle>{container.name}</CardTitle>
          <CardDescription>
            <span class="line-clamp-1 font-mono text-xs">{container.image}</span>
          </CardDescription>
        </div>
        <ContainerStateBadge
          {messages}
          state={container.state as ContainerStateLit}
          size="sm"
        />
      </div>
    </CardHeader>
    <CardBody>
      {#if container.status}
        <p class="line-clamp-1 text-sm text-muted-foreground">{container.status}</p>
      {/if}
    </CardBody>
    <CardFooter>
      <div class="flex w-full flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span data-slot="container-ports" aria-label={ariaPorts} class="font-mono">
          {portsDisplay}
        </span>
        <span aria-label={ariaImage} class="font-mono">
          {container.image.split('/').pop()?.split(':')[0] ?? container.image}
        </span>
      </div>
    </CardFooter>
  </div>
</Card>
