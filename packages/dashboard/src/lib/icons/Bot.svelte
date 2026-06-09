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
	<path d="M12 8V4H8" />
	<rect x="4" y="8" width="16" height="12" rx="2" />
	<path d="M2 14h2" />
	<path d="M20 14h2" />
	<path d="M15 13v.01" />
	<path d="M9 13v.01" />
</svg>
