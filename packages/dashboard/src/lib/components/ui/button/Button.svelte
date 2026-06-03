<!--
  Button — the canonical action primitive.
  Ported from packages/dashboard/src/components/ui/button.tsx (Next.js shadcn).
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { tv } from '$lib/utils/tv';
  import { cn } from '$lib/utils/cn';
  import type { Variant, Size } from './Button.types';

  type Props = {
    variant?: Variant;
    size?: Size;
    type?: 'button' | 'submit' | 'reset';
    href?: string;
    disabled?: boolean;
    loading?: boolean;
    name?: string;
    value?: string;
    form?: string;
    id?: string;
    class?: string;
    children?: Snippet;
    trailing?: Snippet;
    leading?: Snippet;
    onclick?: (e: MouseEvent) => void;
    'aria-label'?: string;
    'aria-labelledby'?: string;
  };

  let {
    variant = 'default',
    size = 'default',
    type = 'button',
    href,
    disabled = false,
    loading = false,
    name,
    value,
    form,
    id,
    class: className,
    children,
    trailing,
    leading,
    onclick,
    ...aria
  }: Props = $props();

  const button = tv({
    base: 'group/button inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20',
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        outline: 'border-border bg-background hover:bg-muted hover:text-foreground dark:border-input dark:bg-input/30',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-muted hover:text-foreground dark:hover:bg-muted/50',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-8 px-2.5',
        sm: 'h-7 rounded-md px-2.5 text-[0.8rem]',
        lg: 'h-10 px-3',
        icon: 'size-8',
      },
    },
    defaults: { variant: 'default', size: 'default' },
  });

  const classes = $derived(button({ variant, size, class: className as string | undefined }));
  const isDisabled = $derived(disabled || loading);
</script>

{#if href && !isDisabled}
  <a
    {href}
    data-slot="button"
    class={cn(classes)}
    role="button"
    aria-disabled={isDisabled}
    onclick={onclick}
    {...aria}
  >
    {#if leading}{@render leading()}{/if}
    {#if children}{@render children()}{/if}
    {#if trailing}{@render trailing()}{/if}
  </a>
{:else}
  <button
    {type}
    {name}
    {value}
    {form}
    {id}
    data-slot="button"
    class={cn(classes)}
    disabled={isDisabled}
    aria-busy={loading || undefined}
    onclick={onclick}
    {...aria}
  >
    {#if leading}{@render leading()}{/if}
    {#if children}{@render children()}{/if}
    {#if trailing}{@render trailing()}{/if}
  </button>
{/if}
