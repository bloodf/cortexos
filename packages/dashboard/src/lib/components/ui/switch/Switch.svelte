<!--
  Switch — toggle switch built on a real <input type="checkbox" role="switch">.
  Keyboard: Space toggles. Screen reader announces state via aria-checked.
-->
<script lang="ts">
  import { cn } from '$lib/utils/cn';
  type Props = {
    checked?: boolean;
    disabled?: boolean;
    name?: string;
    id?: string;
    class?: string;
    onchange?: (e: Event) => void;
    'aria-label'?: string;
    'aria-labelledby'?: string;
  };
  let {
    checked = $bindable(false),
    disabled,
    name,
    id,
    class: className,
    onchange,
    ...aria
  }: Props = $props();
</script>

<label
  data-slot="switch"
  class={cn(
    'group/switch peer relative inline-flex h-[18px] w-8 shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors outline-none',
    'focus-within:ring-3 focus-within:ring-ring/50',
    'disabled:cursor-not-allowed disabled:opacity-50',
    'bg-input dark:bg-input/80',
    'peer-checked:bg-primary',
    className,
  )}
>
  <input
    type="checkbox"
    role="switch"
    {name}
    {id}
    {disabled}
    bind:checked
    onchange={onchange}
    {...aria}
    class="peer absolute inset-0 z-10 cursor-pointer opacity-0 disabled:cursor-not-allowed"
  />
  <span
    data-slot="switch-thumb"
    aria-hidden="true"
    class={cn(
      'pointer-events-none block size-4 rounded-full bg-background ring-0 transition-transform',
      'dark:data-[state=checked]:bg-primary-foreground dark:data-[state=unchecked]:bg-foreground',
      'translate-x-0.5 peer-checked:translate-x-[18px]',
    )}
  ></span>
</label>
