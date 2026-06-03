<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
	}

	let { children }: Props = $props();
</script>

<div class="grid min-h-screen place-items-center bg-background p-4">
	{@render children()}
</div>
