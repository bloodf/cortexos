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
	<path d="M9 2v6" />
	<path d="M15 2v6" />
	<path d="M6 8h12v3a6 6 0 0 1-12 0V8Z" />
	<path d="M12 17v5" />
</svg>
