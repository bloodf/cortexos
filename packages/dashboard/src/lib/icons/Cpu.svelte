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
	<rect x="5" y="5" width="14" height="14" rx="2" />
	<rect x="9" y="9" width="6" height="6" />
	<line x1="3" y1="9" x2="5" y2="9" />
	<line x1="3" y1="15" x2="5" y2="15" />
	<line x1="19" y1="9" x2="21" y2="9" />
	<line x1="19" y1="15" x2="21" y2="15" />
	<line x1="9" y1="3" x2="9" y2="5" />
	<line x1="15" y1="3" x2="15" y2="5" />
	<line x1="9" y1="19" x2="9" y2="21" />
	<line x1="15" y1="19" x2="15" y2="21" />
</svg>
