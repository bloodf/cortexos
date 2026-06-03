<script lang="ts">
  import { cn } from '$lib/utils/cn';
  type Props = {
    checked?: boolean;
    disabled?: boolean;
    required?: boolean;
    name?: string;
    value?: string;
    id?: string;
    invalid?: boolean;
    class?: string;
    onchange?: (e: Event) => void;
  };
  let {
    checked = $bindable(false),
    disabled,
    required,
    name,
    value,
    id,
    invalid,
    class: className,
    onchange,
  }: Props = $props();
</script>

<input
  type="checkbox"
  {name}
  {value}
  {id}
  {disabled}
  {required}
  bind:checked
  data-slot="checkbox"
  aria-invalid={invalid || undefined}
  class={cn(
    'peer size-4 shrink-0 cursor-pointer rounded border border-input bg-transparent transition-colors outline-none',
    'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:border-ring',
    'disabled:cursor-not-allowed disabled:opacity-50',
    'aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20',
    'checked:bg-primary checked:text-primary-foreground checked:border-primary',
    'dark:bg-input/30',
    className,
  )}
  {onchange}
/>
