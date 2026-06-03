<script lang="ts">
	import { LOCALES, LOCALE_LABELS, type Locale } from '$lib/i18n';
	import Select from '$lib/components/ui/Select.svelte';

	interface Props {
		value: Locale;
		onchange?: (next: Locale) => void;
		class?: string;
	}

	let { value = $bindable('en'), onchange, class: className = '' }: Props = $props();

	const options = LOCALES.map((l) => ({ value: l, label: LOCALE_LABELS[l] }));

	function handleChange(e: Event): void {
		const next = (e.currentTarget as HTMLSelectElement).value as Locale;
		value = next;
		onchange?.(next);
	}
</script>

<Select
	name="locale"
	ariaLabel="Language"
	value={value}
	{options}
	class={className}
	onchange={handleChange}
/>
