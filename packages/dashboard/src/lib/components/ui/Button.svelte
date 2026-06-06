<script lang="ts" module>
	export type ButtonVariant =
		| 'default'
		| 'destructive'
		| 'outline'
		| 'secondary'
		| 'ghost'
		| 'link'
		| 'success';

	export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

	const base =
		'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium ' +
		'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ' +
		'focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none ' +
		'disabled:opacity-50 select-none cursor-pointer';

	const variants: Record<ButtonVariant, string> = {
		default: 'bg-primary text-primary-foreground hover:bg-primary/90',
		destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
		outline:
			'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
		secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
		ghost: 'hover:bg-accent hover:text-accent-foreground',
		link: 'text-primary underline-offset-4 hover:underline',
		success: 'bg-success text-success-foreground hover:bg-success/90'
	};

	const sizes: Record<ButtonSize, string> = {
		sm: 'h-8 px-3 text-sm',
		md: 'h-9 px-4 text-sm',
		lg: 'h-10 px-6 text-base',
		icon: 'h-9 w-9 p-0'
	};
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils/cn';

	interface Props {
		variant?: ButtonVariant;
		size?: ButtonSize;
		type?: 'button' | 'submit' | 'reset';
		disabled?: boolean;
		loading?: boolean;
		class?: string;
		ariaLabel?: string;
		ariaControls?: string;
		ariaExpanded?: boolean;
		ariaPressed?: boolean;
		href?: string;
		onclick?: (e: MouseEvent) => void;
		children?: Snippet;
	}

	let {
		variant = 'default',
		size = 'md',
		type = 'button',
		disabled = false,
		loading = false,
		class: className = '',
		ariaLabel,
		ariaControls,
		ariaExpanded,
		ariaPressed,
		href,
		onclick,
		children
	}: Props = $props();

	const isDisabled = $derived(Boolean(disabled || loading));
</script>

<button
	{type}
	disabled={isDisabled}
	aria-busy={loading}
	aria-label={ariaLabel}
	aria-controls={ariaControls}
	aria-expanded={ariaExpanded}
	aria-pressed={ariaPressed}
	class={cn(base, variants[variant], sizes[size], className)}
	{onclick}
>
	{#if loading}
		<span class="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true"></span>
	{/if}
	{#if children}
		{@render children()}
	{/if}
</button>
