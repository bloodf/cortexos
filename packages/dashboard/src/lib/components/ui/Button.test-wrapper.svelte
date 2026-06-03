<script lang="ts">
	import Button from './Button.svelte';

	/**
	 * Test-only wrapper for `Button`. Accepts a plain `label` string
	 * and renders it as default slot content. The wrapper exists
	 * because `Button` declares `children?: Snippet` — a branded type
	 * that cannot be constructed from a plain function in tests —
	 * so the wrapper is the canonical way to pass snippet content from
	 * a Vitest test using Svelte 5's natural `<Component>text</Component>`
	 * children syntax.
	 */
	interface Props {
		label?: string;
		[key: string]: unknown;
	}

	let { label = '', ...rest }: Props = $props();
</script>

<Button {...rest}>
	{label}
</Button>
