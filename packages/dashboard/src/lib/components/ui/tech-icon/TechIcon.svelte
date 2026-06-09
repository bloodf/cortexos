<!--
  TechIcon — deterministic gradient + monogram from a service name.

  Produces a stable visual fingerprint for each service. If an image URL
  is supplied it is used directly; otherwise the first 1-2 alphanumeric
  characters are rendered over a hashed HSL gradient.
-->
<script lang="ts">
	import { cn } from '$lib/utils/cn';

	type Props = {
		name: string;
		slug?: string;
		size?: number;
		image?: string | null;
		class?: string;
	};

	let { name, slug = '', size = 40, image, class: className = '' }: Props = $props();

	const text = $derived.by((): string => {
		const src = name || slug || '?';
		const cleaned = src.replace(/[^a-zA-Z0-9]/g, '');
		return cleaned.slice(0, 2).toUpperCase() || '?';
	});

	const hash = $derived.by((): number => {
		const str = slug || name;
		let h = 0;
		for (let i = 0; i < str.length; i++) {
			h = (Math.imul(31, h) + str.charCodeAt(i)) >>> 0;
		}
		return h;
	});

	const hue1 = $derived(hash % 360);
	const hue2 = $derived((hash * 7) % 360);
	const style = $derived(
		image
			? `width:${size}px;height:${size}px;`
			: `width:${size}px;height:${size}px;background:linear-gradient(135deg,hsl(${hue1} 70% 45%),hsl(${hue2} 70% 35%));color:white;`
	);
</script>

{#if image}
	<img
		src={image}
		alt=""
		class={cn('shrink-0 rounded-md object-cover', className)}
		style={style}
		loading="lazy"
	/>
{:else}
	<div
		class={cn(
			'flex shrink-0 items-center justify-center rounded-md text-xs font-bold',
			className
		)}
		style={style}
		aria-hidden="true"
	>
		{text}
	</div>
{/if}
