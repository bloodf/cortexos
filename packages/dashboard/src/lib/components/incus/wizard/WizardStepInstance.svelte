<!--
  WizardStepInstance — second step of the Incus creation wizard.

  Renders the instance-name input, the type radio (container|vm),
  the storage pool, the CPU count, and the memory in MiB. The
  step is controlled.

  i18n: every visible string routes through `t(messages, 'incus.wizard.instance.*')`.
-->
<script lang="ts">
  import Input from '$lib/components/ui/Input.svelte';
  import { t, type Messages } from '$lib/i18n';
  import { INCUS_TYPES, type IncusTypeLit } from '../adapter';

  type Props = {
    /** The instance slug / name. */
    name: string;
    /** Container or VM. */
    type: IncusTypeLit;
    /** Storage pool name. */
    pool: string;
    /** vCPU count. */
    cpu: number;
    /** Memory in MiB. */
    memory: number;
    /** Known storage pools. */
    pools: readonly string[];
    /** Locale messages (from the root layout's PageData). */
    messages: Messages;
    /** Change handlers. */
    onNameChange: (next: string) => void;
    onTypeChange: (next: IncusTypeLit) => void;
    onPoolChange: (next: string) => void;
    onCpuChange: (next: number) => void;
    onMemoryChange: (next: number) => void;
    /** Optional className passthrough. */
    class?: string;
  };

  let {
    name,
    type,
    pool,
    cpu,
    memory,
    pools,
    messages,
    onNameChange,
    onTypeChange,
    onPoolChange,
    onCpuChange,
    onMemoryChange,
    class: className,
  }: Props = $props();

  const title = $derived(t(messages, 'incus.wizard.instance.title'));
  const description = $derived(t(messages, 'incus.wizard.instance.description'));
  const nameLabel = $derived(t(messages, 'incus.wizard.instance.name'));
  const nameHelp = $derived(t(messages, 'incus.wizard.instance.nameHelp'));
  const typeLabel = $derived(t(messages, 'incus.wizard.instance.type'));
  const poolLabel = $derived(t(messages, 'incus.wizard.instance.pool'));
  const cpuLabel = $derived(t(messages, 'incus.wizard.instance.cpu'));
  const memoryLabel = $derived(t(messages, 'incus.wizard.instance.memory'));
</script>

<div data-slot="wizard-step-instance" class={`flex flex-col gap-4 ${className ?? ''}`}>
  <div>
    <h2 class="text-lg font-semibold">{title}</h2>
    <p class="text-sm text-muted-foreground">{description}</p>
  </div>

  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
    <div class="flex flex-col gap-2">
      <label
        for="wizard-instance-name"
        class="text-xs uppercase tracking-wide text-muted-foreground"
      >
        {nameLabel}
      </label>
      <Input
        id="wizard-instance-name"
        type="text"
        value={name}
        placeholder="my-instance"
        oninput={(e) => onNameChange((e.currentTarget as HTMLInputElement).value)}
      />
      <p class="text-xs text-muted-foreground">{nameHelp}</p>
    </div>

    <div class="flex flex-col gap-2">
      <span class="text-xs uppercase tracking-wide text-muted-foreground">{typeLabel}</span>
      <div class="flex items-center gap-3">
        {#each INCUS_TYPES as tt (tt)}
          <label class="flex items-center gap-1 text-sm">
            <input
              type="radio"
              name="wizard-instance-type"
              value={tt}
              checked={type === tt}
              onchange={() => onTypeChange(tt)}
            />
            {t(messages, `incus.types.${tt}`)}
          </label>
        {/each}
      </div>
    </div>

    <div class="flex flex-col gap-2">
      <label
        for="wizard-instance-pool"
        class="text-xs uppercase tracking-wide text-muted-foreground"
      >
        {poolLabel}
      </label>
      <select
        id="wizard-instance-pool"
        value={pool}
        onchange={(e) => onPoolChange((e.currentTarget as HTMLSelectElement).value)}
        class="h-9 rounded-md border border-input bg-background px-2 text-sm"
      >
        {#each pools as p (p)}
          <option value={p}>{p}</option>
        {/each}
      </select>
    </div>

    <div class="flex flex-col gap-2">
      <label
        for="wizard-instance-cpu"
        class="text-xs uppercase tracking-wide text-muted-foreground"
      >
        {cpuLabel}
      </label>
        <Input
          id="wizard-instance-cpu"
          type="number"
          value={String(cpu)}
          minlength={1}
          maxlength={3}
          oninput={(e) => onCpuChange(Number((e.currentTarget as HTMLInputElement).value))}
        />
    </div>

    <div class="flex flex-col gap-2">
      <label
        for="wizard-instance-memory"
        class="text-xs uppercase tracking-wide text-muted-foreground"
      >
        {memoryLabel}
      </label>
        <Input
          id="wizard-instance-memory"
          type="number"
          value={String(memory)}
          minlength={2}
          maxlength={6}
          oninput={(e) => onMemoryChange(Number((e.currentTarget as HTMLInputElement).value))}
        />
    </div>
  </div>
</div>
