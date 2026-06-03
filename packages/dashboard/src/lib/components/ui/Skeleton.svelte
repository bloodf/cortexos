<script lang="ts">
	import { cn } from '$lib/utils/cn';

	interface Props {
		class?: string;
		width?: string;
		height?: string;
		rounded?: string;
	}

	let {
		class: className = '',
		width = '100%',
		height = '0.75rem',
		rounded = '0.375rem'
	}: Props = $props();
</script>

<span
	aria-hidden="true"
	class={cn('block animate-pulse bg-muted', className)}
	style="width: {width}; height: {height}; border-radius: {rounded};"
></span>
