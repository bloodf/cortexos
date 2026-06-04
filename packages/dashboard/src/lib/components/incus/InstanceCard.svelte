<!--
  InstanceCard — single Incus instance card built on the design-system Card.

  Used in the Incus overview (grid view) and dashboard widgets. The
  card is non-interactive on its own; navigation is provided by
  passing an `onSelect` handler. This keeps the component reusable
  inside non-link surfaces (e.g. an admin side panel).

  i18n: pass the locale `messages` map (from `$lib/i18n`) and every
  visible string routes through `t(messages, 'incus.*')`.
-->
<script lang="ts">
  import type { IncusInstance } from '@cortexos/contracts';
  import { t, type Messages } from '$lib/i18n';
  import Card from '$lib/components/ui/card/Card.svelte';
  import CardHeader from '$lib/components/ui/card/CardHeader.svelte';
  import CardTitle from '$lib/components/ui/card/CardTitle.svelte';
  import CardDescription from '$lib/components/ui/card/CardDescription.svelte';
  import CardBody from '$lib/components/ui/card/CardBody.svelte';
  import CardFooter from '$lib/components/ui/card/CardFooter.svelte';
  import InstanceStateBadge from './InstanceStateBadge.svelte';
  import { formatResources, type IncusStatusLit } from './adapter';

  type Props = {
    /** The full instance record. The component never mutates it. */
    instance: IncusInstance;
    /** Locale messages (from the root layout's PageData). */
    messages: Messages;
    /** Optional click handler (e.g. `navigate('/incus/${name}')`). */
    onSelect?: (instance: IncusInstance) => void;
    /** Optional className passthrough for layout grids. */
    class?: string;
  };

  let { instance, messages, onSelect, class: className }: Props = $props();

  /** Icon monogram — first 1-2 characters of the name, upper-cased. */
  const monogram = $derived.by(() => {
    const n = instance.name ?? '';
    const cleaned = n.replace(/[^a-z0-9]/gi, '');
    return cleaned.slice(0, 2).toUpperCase() || '?';
  });

  const { cpu, memory } = $derived(formatResources(instance));
  const typeLabel = $derived(t(messages, `incus.types.${instance.type}`));

  function handleClick(): void {
    if (onSelect) onSelect(instance);
  }

  function handleKey(event: KeyboardEvent): void {
    if (!onSelect) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(instance);
    }
  }
</script>

<Card size="default" class={className}>
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div
    role={onSelect ? 'button' : undefined}
    tabindex={onSelect ? 0 : undefined}
    data-slot="instance-card"
    data-instance-name={instance.name}
    onclick={handleClick}
    onkeydown={handleKey}
    class="flex h-full cursor-pointer flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  >
    <CardHeader>
      <div class="flex items-start gap-3">
        <div
          data-slot="instance-icon"
          aria-hidden="true"
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
          style:background-color="#7c3aed"
        >
          {monogram}
        </div>
        <div class="min-w-0 flex-1">
          <CardTitle>{instance.name}</CardTitle>
          <CardDescription>
            <span class="line-clamp-1 font-mono text-xs">{instance.image}</span>
          </CardDescription>
        </div>
        <InstanceStateBadge
          {messages}
          state={instance.status as IncusStatusLit}
          size="sm"
        />
      </div>
    </CardHeader>
    <CardBody>
      <p class="line-clamp-1 text-sm text-muted-foreground">
        {typeLabel}
      </p>
    </CardBody>
    <CardFooter>
      <div class="flex w-full flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span data-slot="instance-cpu" class="font-mono">{cpu}</span>
        <span data-slot="instance-memory" class="font-mono">{memory}</span>
      </div>
    </CardFooter>
  </div>
</Card>
