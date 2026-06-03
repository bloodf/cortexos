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
	<rect x="3" y="3" width="7" height="9" rx="1.5" />
	<rect x="14" y="3" width="7" height="5" rx="1.5" />
	<rect x="14" y="12" width="7" height="9" rx="1.5" />
	<rect x="3" y="16" width="7" height="5" rx="1.5" />
</svg>
