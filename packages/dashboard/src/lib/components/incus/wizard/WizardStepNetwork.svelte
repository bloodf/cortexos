<!--
  WizardStepNetwork — third step of the Incus creation wizard.

  Renders the network bridge, the Tailscale toggle, and the
  webAccess toggle. The step is controlled.

  i18n: every visible string routes through `t(messages, 'incus.wizard.network.*')`.
-->
<script lang="ts">
  import { t, type Messages } from '$lib/i18n';

  type Props = {
    /** Network bridge (e.g. `incusbr0`). */
    bridge: string;
    /** Whether the instance should be reachable via Tailscale. */
    tailscale: boolean;
    /** Whether the instance should serve a public web UI. */
    webAccess: boolean;
    /** Known bridges to pick from. */
    bridges: readonly string[];
    /** Locale messages (from the root layout's PageData). */
    messages: Messages;
    /** Change handlers. */
    onBridgeChange: (next: string) => void;
    onTailscaleChange: (next: boolean) => void;
    onWebAccessChange: (next: boolean) => void;
    /** Optional className passthrough. */
    class?: string;
  };

  let {
    bridge,
    tailscale,
    webAccess,
    bridges,
    messages,
    onBridgeChange,
    onTailscaleChange,
    onWebAccessChange,
    class: className,
  }: Props = $props();

  const title = $derived(t(messages, 'incus.wizard.network.title'));
  const description = $derived(t(messages, 'incus.wizard.network.description'));
  const bridgeLabel = $derived(t(messages, 'incus.wizard.network.bridge'));
  const tailscaleLabel = $derived(t(messages, 'incus.wizard.network.tailscale'));
  const tailscaleHelp = $derived(t(messages, 'incus.wizard.network.tailscaleHelp'));
  const webAccessLabel = $derived(t(messages, 'incus.wizard.network.webAccess'));
  const webAccessHelp = $derived(t(messages, 'incus.wizard.network.webAccessHelp'));
</script>

<div data-slot="wizard-step-network" class={`flex flex-col gap-4 ${className ?? ''}`}>
  <div>
    <h2 class="text-lg font-semibold">{title}</h2>
    <p class="text-sm text-muted-foreground">{description}</p>
  </div>

  <div class="flex flex-col gap-2">
    <label
      for="wizard-network-bridge"
      class="text-xs uppercase tracking-wide text-muted-foreground"
    >
      {bridgeLabel}
    </label>
    <select
      id="wizard-network-bridge"
      value={bridge}
      onchange={(e) => onBridgeChange((e.currentTarget as HTMLSelectElement).value)}
      class="h-9 rounded-md border border-input bg-background px-2 text-sm"
    >
      {#each bridges as b (b)}
        <option value={b}>{b}</option>
      {/each}
    </select>
  </div>

  <div class="flex items-start gap-3">
    <input
      id="wizard-network-tailscale"
      type="checkbox"
      checked={tailscale}
      onchange={(e) => onTailscaleChange((e.currentTarget as HTMLInputElement).checked)}
    />
    <div>
      <label for="wizard-network-tailscale" class="text-sm font-medium">
        {tailscaleLabel}
      </label>
      <p class="text-xs text-muted-foreground">{tailscaleHelp}</p>
    </div>
  </div>

  <div class="flex items-start gap-3">
    <input
      id="wizard-network-web"
      type="checkbox"
      checked={webAccess}
      onchange={(e) => onWebAccessChange((e.currentTarget as HTMLInputElement).checked)}
    />
    <div>
      <label for="wizard-network-web" class="text-sm font-medium">{webAccessLabel}</label>
      <p class="text-xs text-muted-foreground">{webAccessHelp}</p>
    </div>
  </div>
</div>
