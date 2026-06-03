<script lang="ts">
	import Button from './Button.svelte';

	/**
	 * Test-only wrapper for `Button`. Accepts a plain `label` string
	 * and renders it inside a real Svelte 5 `{#snippet children()}`.
	 * `Button` declares `children?: Snippet` — a branded type that
	 * cannot be constructed from a plain function in tests — so this
	 * wrapper is the canonical way to pass snippet content from a
	 * Vitest test.
	 */
	interface Props {
		label?: string;
		[key: string]: unknown;
	}

	let { label = '', ...rest }: Props = $props();
</script>

<Button {...rest}>
	{#snippet children()}{label}{/snippet}
</Button>
