<!--
  Input — the canonical text input primitive. Forwarded to <input> with
  shadcn-style classes. Pair with <Label> for accessibility.
-->
<script lang="ts">
  import { cn } from '$lib/utils/cn';

  type Props = {
    type?: 'text' | 'email' | 'password' | 'search' | 'url' | 'tel' | 'number' | 'date';
    value?: string | number;
    placeholder?: string;
    disabled?: boolean;
    readonly?: boolean;
    required?: boolean;
    name?: string;
    id?: string;
    invalid?: boolean;
    class?: string;
    oninput?: (e: Event) => void;
    onchange?: (e: Event) => void;
    onfocus?: (e: FocusEvent) => void;
    onblur?: (e: FocusEvent) => void;
  };
  let {
    type = 'text',
    value = $bindable(''),
    placeholder,
    disabled,
    readonly,
    required,
    name,
    id,
    invalid,
    class: className,
    oninput,
    onchange,
    onfocus,
    onblur,
  }: Props = $props();
</script>

<input
  {type}
  {name}
  {id}
  {placeholder}
  {disabled}
  {readonly}
  {required}
  bind:value
  data-slot="input"
  aria-invalid={invalid || undefined}
  class={cn(
    'h-8 w-full min-w-0 rounded-md border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none',
    'placeholder:text-muted-foreground',
    'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
    'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
    'aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20',
    'dark:bg-input/30',
    className,
  )}
  {oninput}
  {onchange}
  {onfocus}
  {onblur}
/>
