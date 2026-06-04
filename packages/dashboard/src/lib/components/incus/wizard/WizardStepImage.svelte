<!--
  WizardStepImage — first step of the Incus creation wizard.

  Renders an image alias dropdown + an optional `gastown` toggle.
  The step is controlled: the page passes the current values down
  and reacts to the `onChange` event with the new state.

  i18n: every visible string routes through `t(messages, 'incus.wizard.image.*')`.
-->
<script lang="ts">
  import Select from '$lib/components/ui/Select.svelte';
  import Input from '$lib/components/ui/Input.svelte';
  import { t, type Messages } from '$lib/i18n';

  type Props = {
    /** Current image alias (e.g. `ubuntu/24.04`). */
    alias: string;
    /** Whether the gastown bootstrap should run on launch. */
    gastown: boolean;
    /** Known aliases to show in the dropdown. */
    aliases: readonly string[];
    /** Locale messages (from the root layout's PageData). */
    messages: Messages;
    /** Change handlers. */
    onAliasChange: (next: string) => void;
    onGastownChange: (next: boolean) => void;
    /** Optional className passthrough. */
    class?: string;
  };

  let {
    alias,
    gastown,
    aliases,
    messages,
    onAliasChange,
    onGastownChange,
    class: className,
  }: Props = $props();

  const title = $derived(t(messages, 'incus.wizard.image.title'));
  const description = $derived(t(messages, 'incus.wizard.image.description'));
  const aliasLabel = $derived(t(messages, 'incus.wizard.image.alias'));
  const aliasHelp = $derived(t(messages, 'incus.wizard.image.aliasHelp'));
  const customLabel = $derived(t(messages, 'incus.wizard.image.custom'));
  const customHelp = $derived(t(messages, 'incus.wizard.image.customHelp'));
  const customValue = '__custom__';
</script>

<div data-slot="wizard-step-image" class={`flex flex-col gap-4 ${className ?? ''}`}>
  <div>
    <h2 class="text-lg font-semibold">{title}</h2>
    <p class="text-sm text-muted-foreground">{description}</p>
  </div>

  <div class="flex flex-col gap-2">
    <label
      for="wizard-image-alias"
      class="text-xs uppercase tracking-wide text-muted-foreground"
    >
      {aliasLabel}
    </label>
    <Select
      id="wizard-image-alias"
      value={aliases.includes(alias) ? alias : customValue}
      options={[
        ...aliases.map((a) => ({ value: a, label: a })),
        { value: customValue, label: customLabel },
      ]}
      onchange={(e) => {
        const v = (e.currentTarget as HTMLSelectElement).value;
        if (v === customValue) {
          onAliasChange('');
        } else {
          onAliasChange(v);
        }
      }}
    />
    <p class="text-xs text-muted-foreground">{aliasHelp}</p>
  </div>

  {#if !aliases.includes(alias)}
    <div class="flex flex-col gap-2">
      <label
        for="wizard-image-custom"
        class="text-xs uppercase tracking-wide text-muted-foreground"
      >
        {customLabel}
      </label>
      <Input
        id="wizard-image-custom"
        type="text"
        value={alias}
        placeholder="e.g. ubuntu/24.04"
        oninput={(e) => onAliasChange((e.currentTarget as HTMLInputElement).value)}
      />
      <p class="text-xs text-muted-foreground">{customHelp}</p>
    </div>
  {/if}
</div>
