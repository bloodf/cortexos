<script lang="ts">
	import { cn } from '$lib/utils/cn';
	import ChevronDown from '$lib/icons/ChevronDown.svelte';

	export interface SelectOption {
		value: string;
		label: string;
		disabled?: boolean;
	}

	interface Props {
		class?: string;
		name?: string;
		id?: string;
		value?: string;
		placeholder?: string;
		options: readonly SelectOption[];
		required?: boolean;
		disabled?: boolean;
		ariaLabel?: string;
		onchange?: (e: Event) => void;
	}

	let {
		class: className = '',
		name,
		id,
		value = $bindable(''),
		placeholder,
		options,
		required = false,
		disabled = false,
		ariaLabel,
		onchange
	}: Props = $props();
</script>

<div class="relative">
	<select
		{name}
		{id}
		bind:value
		{required}
		{disabled}
		aria-label={ariaLabel}
		class={cn(
			'flex h-9 w-full appearance-none rounded-md border border-input bg-background px-3 py-1 pr-8 text-sm shadow-sm ' +
				'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ' +
				'focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50',
			className
		)}
		{onchange}
	>
		{#if placeholder}
			<option value="" disabled selected={!value}>{placeholder}</option>
		{/if}
		{#each options as option (option.value)}
			<option value={option.value} disabled={option.disabled}>{option.label}</option>
		{/each}
	</select>
	<span
		class="pointer-events-none absolute inset-y-0 right-2 flex items-center text-muted-foreground"
		aria-hidden="true"
	>
		<ChevronDown class="h-4 w-4" />
	</span>
</div>
