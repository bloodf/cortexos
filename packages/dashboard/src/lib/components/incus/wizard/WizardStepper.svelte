<!--
  WizardStepper — visual indicator for the current step in the
  Incus creation wizard. Renders a row of step chips: each step
  is a label + a circle showing its index. The current step is
  highlighted; completed steps are checked.

  The component is presentational. The page owns the `current`
  index and renders the active step's body outside the stepper.

  i18n: the step labels are passed in by the parent (i18n-resolved
  via `t(messages, 'incus.wizard.steps.<key>')`).
-->
<script lang="ts">
  import { t, type Messages } from '$lib/i18n';

  type Step = { key: string; label: string };

  type Props = {
    /** The ordered list of step keys + their i18n-resolved labels. */
    steps: readonly Step[];
    /** The 0-indexed current step. */
    current: number;
    /** Locale messages (from the root layout's PageData). */
    messages: Messages;
    /** Optional className passthrough. */
    class?: string;
  };

  let { steps, current, messages, class: className }: Props = $props();
  // svelte-ignore state_referenced_locally
  void messages;
</script>

<ol
  data-slot="wizard-stepper"
  class={`flex flex-wrap items-center gap-2 ${className ?? ''}`}
  aria-label="Wizard steps"
>
  {#each steps as step, i (step.key)}
    {@const isCurrent = i === current}
    {@const isDone = i < current}
    <li
      data-slot="wizard-step"
      data-step-key={step.key}
      data-current={String(isCurrent)}
      data-done={String(isDone)}
      class="flex items-center gap-2"
    >
      <span
        class={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
          isCurrent
            ? 'bg-primary text-primary-foreground'
            : isDone
              ? 'bg-success text-success-foreground'
              : 'border border-border bg-background text-muted-foreground'
        }`}
      >
        {isDone ? '✓' : i + 1}
      </span>
      <span class={`text-sm ${isCurrent ? 'font-medium' : 'text-muted-foreground'}`}>
        {step.label}
      </span>
      {#if i < steps.length - 1}
        <span class="text-muted-foreground" aria-hidden="true">→</span>
      {/if}
    </li>
  {/each}
</ol>
