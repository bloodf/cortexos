<script lang="ts">
	interface Props {
		class?: string;
		size?: number;
	}
	let { class: className = 'h-5 w-5', size }: Props = $props();
</script>

<svg
	xmlns="http://www.w3.org/2000/svg"
	viewBox="0 0 24 24"
	width={size ?? 24}
	height={size ?? 24}
	fill="none"
	stroke="currentColor"
	stroke-width="1.75"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
	class={className}
>
	<line x1="3" y1="6" x2="21" y2="6" />
	<line x1="3" y1="12" x2="21" y2="12" />
	<line x1="3" y1="18" x2="21" y2="18" />
</svg>
