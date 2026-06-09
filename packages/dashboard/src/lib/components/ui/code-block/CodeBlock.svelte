<!--
  CodeBlock — code display with language label and a copy button.
-->
<script lang="ts">
	import IconButton from '$lib/components/ui/icon-button/IconButton.svelte';
	import Copy from '$lib/icons/Copy.svelte';
	import Check from '$lib/icons/Check.svelte';

	type Props = {
		code: string;
		language?: string;
		class?: string;
		maxHeight?: number;
	};

	let { code, language = 'text', class: className, maxHeight }: Props = $props();

	let copied = $state(false);

	async function handleCopy() {
		try {
			await navigator.clipboard.writeText(code);
			copied = true;
			setTimeout(() => {
				copied = false;
			}, 1500);
		} catch {
			// ignore
		}
	}
</script>

<div
	class="relative group rounded-md border bg-[oklch(0.14_0.01_260)] text-[oklch(0.92_0.01_260)] {className ?? ''}"
>
	<div
		class="flex items-center justify-between border-b border-white/5 px-3 py-1.5 text-[10px] uppercase tracking-wide text-white/50"
	>
		<span>{language}</span>
		<IconButton variant="ghost" aria-label="Copy" onclick={handleCopy}>
			{#if copied}
				<Check class="size-3 text-white" />
			{:else}
				<Copy class="size-3 text-white/70" />
			{/if}
		</IconButton>
	</div>
	<pre
		class="overflow-auto p-3 text-xs leading-relaxed font-mono tabular-nums"
		style:max-height={maxHeight ? `${maxHeight}px` : undefined}
	><code>{code}</code></pre>
</div>
