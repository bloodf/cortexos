<!--
  IconButton — square button designed for icon-only usage.

  Always requires an aria-label (or accessible label) so screen readers can
  describe the action. Renders a Button with size="icon".
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import Button from '../button/Button.svelte';

  type Variant = 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive';
  type Props = {
    variant?: Variant;
    type?: 'button' | 'submit' | 'reset';
    href?: string;
    disabled?: boolean;
    loading?: boolean;
    class?: string;
    children?: Snippet;
    'aria-label': string;
    onclick?: (e: MouseEvent) => void;
  };

  let { variant = 'ghost', type = 'button', href, disabled, loading, class: className, children, ...rest }: Props = $props();
</script>

<Button
  {variant}
  {type}
  {href}
  {disabled}
  {loading}
  size="icon"
  class={className}
  {...rest}
>
  {#if children}{@render children()}{/if}
</Button>
