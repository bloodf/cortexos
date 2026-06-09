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
	<path d="M12 20h.01" />
	<path d="M2 8.82a15 15 0 0 1 20 0" />
	<path d="M5 12.859a10 10 0 0 1 14 0" />
	<path d="M8.5 16.429a5 5 0 0 1 7 0" />
</svg>
