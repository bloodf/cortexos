<!--
  Slider — single-thumb range input. Use the native <input type="range"> for
  full keyboard support (Left/Right arrows, Home/End).
-->
<script lang="ts">
  import { cn } from '$lib/utils/cn';
  type Props = {
    value?: number;
    min?: number;
    max?: number;
    step?: number;
    disabled?: boolean;
    name?: string;
    id?: string;
    invalid?: boolean;
    class?: string;
    oninput?: (e: Event) => void;
    'aria-label'?: string;
  };
  let {
    value = $bindable(0),
    min = 0,
    max = 100,
    step = 1,
    disabled,
    name,
    id,
    invalid,
    class: className,
    oninput,
    ...aria
  }: Props = $props();
</script>

<input
  type="range"
  {name}
  {id}
  {min}
  {max}
  {step}
  {disabled}
  bind:value
  data-slot="slider"
  aria-invalid={invalid || undefined}
  class={cn(
    'h-2 w-full cursor-pointer appearance-none rounded-full bg-secondary outline-none',
    'accent-primary',
    'disabled:cursor-not-allowed disabled:opacity-50',
    className,
  )}
  {oninput}
  {...aria}
/>
