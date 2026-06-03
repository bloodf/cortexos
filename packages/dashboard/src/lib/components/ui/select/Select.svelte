<script lang="ts">
  import { cn } from '$lib/utils/cn';
  type Props = {
    value?: string;
    placeholder?: string;
    disabled?: boolean;
    required?: boolean;
    name?: string;
    id?: string;
    invalid?: boolean;
    class?: string;
    onchange?: (e: Event) => void;
    children?: import('svelte').Snippet;
  };
  let {
    value = $bindable(''),
    placeholder,
    disabled,
    required,
    name,
    id,
    invalid,
    class: className,
    onchange,
    children,
  }: Props = $props();
</script>

<select
  {name}
  {id}
  {placeholder}
  {disabled}
  {required}
  bind:value
  data-slot="select"
  aria-invalid={invalid || undefined}
  class={cn(
    'h-8 w-full min-w-0 rounded-md border border-input bg-transparent px-2 py-1 text-sm transition-colors outline-none',
    'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
    'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
    'aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20',
    'dark:bg-input/30',
    className,
  )}
  {onchange}
>
  {#if children}{@render children()}{/if}
</select>
