<!--
  ContainerSearch — controlled search + state filter for the
  Docker list.

  Composed of a free-text input and a state select. The component
  is fully controlled: every change fires a callback so the parent
  (page + DataTable) is the single source of truth for the filter
  state. URL search params are wired by the parent in +page.svelte.

  The two-way state is deliberately local + lifted:
    - The text input keeps its own buffer so typing is smooth even
      if the parent re-renders (no cursor jump on debounce).
    - `onChange` only fires after a short idle window (150ms), so
      we don't push every keystroke into the URL.

  i18n: every visible string (placeholder, select label, clear
  button, region aria-label) routes through t(messages, ...).
-->
<script lang="ts">
  import Input from '$lib/components/ui/Input.svelte';
  import Select from '$lib/components/ui/Select.svelte';
  import { t, type Messages } from '$lib/i18n';

  type StateFilter = 'all' | 'running' | 'stopped' | 'paused' | 'restarting';

  type Props = {
    /** Free-text query. */
    query: string;
    /** Active state filter (`'all'` is the default). */
    stateFilter: StateFilter;
    /** Locale messages (from the root layout's PageData). */
    messages: Messages;
    /** Fires after the debounce window. */
    onChange: (next: { query: string; stateFilter: StateFilter }) => void;
    /** Optional className passthrough. */
    class?: string;
  };

  let { query, stateFilter, messages, onChange, class: className }: Props = $props();

  // svelte-ignore state_referenced_locally -- intentional initial value
  let buffer = $state(query);
  // svelte-ignore state_referenced_locally -- intentional initial value
  let st = $state(stateFilter);

  let debounceId: ReturnType<typeof setTimeout> | null = null;

  function scheduleCommit(): void {
    if (debounceId) clearTimeout(debounceId);
    debounceId = setTimeout(() => {
      onChange({ query: buffer, stateFilter: st });
    }, 150);
  }

  const stateOptions = $derived([
    { value: 'all', label: t(messages, 'docker.search.allStates') },
    { value: 'running', label: t(messages, 'docker.status.running') },
    { value: 'stopped', label: t(messages, 'docker.search.stopped') },
    { value: 'paused', label: t(messages, 'docker.status.paused') },
    { value: 'restarting', label: t(messages, 'docker.status.restarting') },
  ]);

  const hasValue = $derived(buffer.trim() !== '' || st !== 'all');

  // Re-sync local buffer if the parent resets the URL state externally.
  $effect(() => {
    if (query !== buffer && document.activeElement?.tagName !== 'INPUT') {
      buffer = query;
    }
  });
  $effect(() => {
    if (stateFilter !== st && document.activeElement?.tagName !== 'SELECT') {
      st = stateFilter;
    }
  });

  function clear(): void {
    buffer = '';
    st = 'all';
    onChange({ query: '', stateFilter: 'all' });
  }

  const ariaLabel = $derived(t(messages, 'docker.search.label'));
  const placeholder = $derived(t(messages, 'docker.search.placeholder'));
  const clearLabel = $derived(t(messages, 'docker.search.clear'));
  const selectAriaLabel = $derived(t(messages, 'docker.search.allStates'));
</script>

<div
  data-slot="container-search"
  class={`flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between ${className ?? ''}`}
  role="search"
  aria-label={ariaLabel}
>
  <div class="flex flex-1 items-center gap-2">
    <Input
      type="search"
      placeholder={placeholder}
      bind:value={buffer}
      oninput={scheduleCommit}
      class="max-w-md"
    />
    <Select
      ariaLabel={selectAriaLabel}
      value={st}
      options={stateOptions}
      onchange={(e) => {
        st = (e.currentTarget as HTMLSelectElement).value as StateFilter;
        scheduleCommit();
      }}
      class="max-w-[12rem]"
    />
    {#if hasValue}
      <button
        type="button"
        data-slot="container-search-clear"
        class="text-xs text-muted-foreground underline-offset-2 hover:underline"
        onclick={clear}
      >
        {clearLabel}
      </button>
    {/if}
  </div>
</div>
