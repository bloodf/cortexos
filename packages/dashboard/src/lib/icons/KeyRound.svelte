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
	<path d="M2 17a4 4 0 0 0 4 4 4 4 0 0 0 4-4 4 4 0 0 0-4-4H2Z" />
	<path d="M14 7h7v3h-3v3h-3v-3h-1" />
	<circle cx="6" cy="17" r="1.5" />
</svg>
