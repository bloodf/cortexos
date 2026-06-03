<script lang="ts">
  import { cn } from '$lib/utils/cn';
  type Props = {
    name?: string;
    value?: string;
    checked?: boolean;
    disabled?: boolean;
    required?: boolean;
    id?: string;
    invalid?: boolean;
    class?: string;
    onchange?: (e: Event) => void;
  };
  let {
    name,
    value,
    checked = false,
    disabled,
    required,
    id,
    invalid,
    class: className,
    onchange,
  }: Props = $props();
</script>

<!-- svelte-ignore a11y_role_supports_aria_props -->
<div data-slot="radio" role="radio" aria-invalid={invalid || undefined} aria-checked={checked} class="inline-flex">
  <input
    type="radio"
    {name}
    {value}
    {id}
    {disabled}
    {required}
    {checked}
    onchange={(e) => {
      checked = (e.currentTarget as HTMLInputElement).checked;
      onchange?.(e);
    }}
    data-slot="radio-input"
    class={cn(
      'peer size-4 shrink-0 cursor-pointer rounded-full border border-input bg-transparent transition-colors outline-none',
      'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:border-ring',
      'disabled:cursor-not-allowed disabled:opacity-50',
      'aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20',
      'checked:bg-primary checked:border-primary',
      'dark:bg-input/30',
      className,
    )}
  />
</div>
