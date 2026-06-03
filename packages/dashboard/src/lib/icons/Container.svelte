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
	<rect x="3" y="7" width="18" height="13" rx="1.5" />
	<path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
	<line x1="3" y1="13" x2="21" y2="13" />
</svg>
