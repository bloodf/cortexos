<!--
  WizardStepProfile — fourth step of the Incus creation wizard.

  Renders the Hermes profile toggle + port + model + proxies. The
  step is controlled.

  i18n: every visible string routes through `t(messages, 'incus.wizard.profile.*')`.
-->
<script lang="ts">
  import Input from '$lib/components/ui/Input.svelte';
  import { t, type Messages } from '$lib/i18n';

  type Props = {
    /** Whether the Hermes agent is enabled. */
    hermesEnabled: boolean;
    /** Hermes profile name. */
    hermesProfile: string;
    /** Hermes API port. */
    hermesPort: number;
    /** Hermes model id. */
    hermesModel: string;
    /** Locale messages (from the root layout's PageData). */
    messages: Messages;
    /** Change handlers. */
    onHermesEnabledChange: (next: boolean) => void;
    onHermesProfileChange: (next: string) => void;
    onHermesPortChange: (next: number) => void;
    onHermesModelChange: (next: string) => void;
    /** Optional className passthrough. */
    class?: string;
  };

  let {
    hermesEnabled,
    hermesProfile,
    hermesPort,
    hermesModel,
    messages,
    onHermesEnabledChange,
    onHermesProfileChange,
    onHermesPortChange,
    onHermesModelChange,
    class: className,
  }: Props = $props();

  const title = $derived(t(messages, 'incus.wizard.profile.title'));
  const description = $derived(t(messages, 'incus.wizard.profile.description'));
  const enabledLabel = $derived(t(messages, 'incus.wizard.profile.enabled'));
  const enabledHelp = $derived(t(messages, 'incus.wizard.profile.enabledHelp'));
  const profileLabel = $derived(t(messages, 'incus.wizard.profile.profile'));
  const portLabel = $derived(t(messages, 'incus.wizard.profile.port'));
  const portHelp = $derived(t(messages, 'incus.wizard.profile.portHelp'));
  const modelLabel = $derived(t(messages, 'incus.wizard.profile.model'));
</script>

<div data-slot="wizard-step-profile" class={`flex flex-col gap-4 ${className ?? ''}`}>
  <div>
    <h2 class="text-lg font-semibold">{title}</h2>
    <p class="text-sm text-muted-foreground">{description}</p>
  </div>

  <div class="flex items-start gap-3">
    <input
      id="wizard-profile-enabled"
      type="checkbox"
      checked={hermesEnabled}
      onchange={(e) => onHermesEnabledChange((e.currentTarget as HTMLInputElement).checked)}
    />
    <div>
      <label for="wizard-profile-enabled" class="text-sm font-medium">{enabledLabel}</label>
      <p class="text-xs text-muted-foreground">{enabledHelp}</p>
    </div>
  </div>

  {#if hermesEnabled}
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div class="flex flex-col gap-2">
        <label
          for="wizard-profile-profile"
          class="text-xs uppercase tracking-wide text-muted-foreground"
        >
          {profileLabel}
        </label>
        <Input
          id="wizard-profile-profile"
          type="text"
          value={hermesProfile}
          oninput={(e) => onHermesProfileChange((e.currentTarget as HTMLInputElement).value)}
        />
      </div>
      <div class="flex flex-col gap-2">
        <label
          for="wizard-profile-port"
          class="text-xs uppercase tracking-wide text-muted-foreground"
        >
          {portLabel}
        </label>
        <Input
          id="wizard-profile-port"
          type="number"
          value={String(hermesPort)}
          minlength={1}
          maxlength={5}
          oninput={(e) => onHermesPortChange(Number((e.currentTarget as HTMLInputElement).value))}
        />
        <p class="text-xs text-muted-foreground">{portHelp}</p>
      </div>
      <div class="flex flex-col gap-2">
        <label
          for="wizard-profile-model"
          class="text-xs uppercase tracking-wide text-muted-foreground"
        >
          {modelLabel}
        </label>
        <Input
          id="wizard-profile-model"
          type="text"
          value={hermesModel}
          oninput={(e) => onHermesModelChange((e.currentTarget as HTMLInputElement).value)}
        />
      </div>
    </div>
  {/if}
</div>
