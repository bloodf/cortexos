<script lang="ts">
  import { cn } from '$lib/utils/cn';
  type Props = {
    value?: string;
    placeholder?: string;
    disabled?: boolean;
    readonly?: boolean;
    required?: boolean;
    name?: string;
    id?: string;
    rows?: number;
    invalid?: boolean;
    class?: string;
    oninput?: (e: Event) => void;
  };
  let {
    value = $bindable(''),
    placeholder,
    disabled,
    readonly,
    required,
    name,
    id,
    rows = 4,
    invalid,
    class: className,
    oninput,
  }: Props = $props();
</script>

<textarea
  {name}
  {id}
  {placeholder}
  {disabled}
  {readonly}
  {required}
  {rows}
  bind:value
  data-slot="textarea"
  aria-invalid={invalid || undefined}
  class={cn(
    'w-full min-w-0 rounded-md border border-input bg-transparent px-2.5 py-1.5 text-sm transition-colors outline-none',
    'placeholder:text-muted-foreground',
    'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
    'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
    'aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20',
    'dark:bg-input/30',
    'resize-y',
    className,
  )}
  {oninput}
></textarea>
