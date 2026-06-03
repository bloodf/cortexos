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
	<rect x="3" y="3" width="6" height="6" rx="1" />
	<rect x="15" y="3" width="6" height="6" rx="1" />
	<rect x="9" y="15" width="6" height="6" rx="1" />
	<path d="M6 9v3a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3V9" />
	<path d="M12 12v3" />
</svg>
