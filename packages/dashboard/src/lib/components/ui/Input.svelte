<script lang="ts">
	import { cn } from '$lib/utils/cn';

	interface Props {
		class?: string;
		name?: string;
		id?: string;
		type?: 'text' | 'email' | 'password' | 'number' | 'search' | 'url' | 'tel';
		value?: string;
		placeholder?: string;
		required?: boolean;
		disabled?: boolean;
		readonly?: boolean;
		/** Browser autofill hint. Mirrors HTML `autocomplete` attribute. */
		autocomplete?: HTMLInputElement['autocomplete'];
		/** Mount focused. Use sparingly — only one input per page. */
		autofocus?: boolean;
		ariaInvalid?: boolean;
		ariaDescribedby?: string;
		minlength?: number;
		maxlength?: number;
		oninput?: (e: Event) => void;
		onchange?: (e: Event) => void;
	}

	let {
		class: className = '',
		name,
		id,
		type = 'text',
		value = $bindable(''),
		placeholder,
		required = false,
		disabled = false,
		readonly = false,
		autocomplete,
		autofocus = false,
		ariaInvalid,
		ariaDescribedby,
		minlength,
		maxlength,
		oninput,
		onchange
	}: Props = $props();
</script>

<input
	{name}
	{id}
	{type}
	bind:value
	{placeholder}
	{required}
	{disabled}
	{readonly}
	{autocomplete}
	{autofocus}
	minlength={minlength ?? null}
	maxlength={maxlength ?? null}
	aria-invalid={ariaInvalid ?? null}
	aria-describedby={ariaDescribedby ?? null}
	class={cn(
		'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm ' +
			'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 ' +
			'focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background ' +
			'disabled:cursor-not-allowed disabled:opacity-50',
		className
	)}
	{oninput}
	{onchange}
/>
