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
	<circle cx="12" cy="12" r="3" />
	<path d="M12 3v3" />
	<path d="M12 18v3" />
	<path d="M3 12h3" />
	<path d="M18 12h3" />
</svg>
