<!--
  InstanceSearch — search input + type filter for the Incus list page.

  The component is controlled: the page passes the current values
  down and reacts to the `onChange` event with the new state. The
  page is the single source of truth — the input never owns its
  own state.

  i18n: placeholders, labels, and filter values route through
  `t(messages, 'incus.search.*')` + `t(messages, 'incus.types.*')`.
-->
<script lang="ts">
  import Input from '$lib/components/ui/Input.svelte';
  import Select from '$lib/components/ui/Select.svelte';
  import { t, type Messages } from '$lib/i18n';
  import { INCUS_TYPES, type TypeFilter } from './adapter';

  type Props = {
    /** Current search query. */
    query: string;
    /** Current type filter. */
    type: TypeFilter;
    /** Locale messages (from the root layout's PageData). */
    messages: Messages;
    /** Change handler (debounced by the page). */
    onQueryChange: (next: string) => void;
    onTypeChange: (next: TypeFilter) => void;
    /** Optional className passthrough. */
    class?: string;
  };

  let { query, type, messages, onQueryChange, onTypeChange, class: className }: Props =
    $props();

  const placeholder = $derived(t(messages, 'incus.search.placeholder'));
  const label = $derived(t(messages, 'incus.search.label'));
  const allTypesLabel = $derived(t(messages, 'incus.search.allTypes'));
</script>

<div
  data-slot="instance-search"
  class={`flex flex-wrap items-end gap-3 ${className ?? ''}`}
  role="search"
  aria-label={label}
>
  <div class="flex-1 min-w-[200px]">
    <label for="instance-search-input" class="sr-only">{label}</label>
    <Input
      id="instance-search-input"
      type="search"
      value={query}
      placeholder={placeholder}
      oninput={(e) => onQueryChange((e.currentTarget as HTMLInputElement).value)}
    />
  </div>
  <div class="w-[180px]">
    <label for="instance-search-type" class="sr-only">{label}</label>
    <Select
      id="instance-search-type"
      value={type}
      options={[
        { value: 'all', label: allTypesLabel },
        ...INCUS_TYPES.map((tt) => ({
          value: tt,
          label: t(messages, `incus.types.${tt}`),
        })),
      ]}
      onchange={(e) => onTypeChange((e.currentTarget as HTMLSelectElement).value as TypeFilter)}
    />
  </div>
</div>
