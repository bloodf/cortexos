<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import type { LayoutData } from './$types';
	import type { Snippet } from 'svelte';

	interface Props {
		data: LayoutData;
		children: Snippet;
	}

	let { data, children }: Props = $props();

	// Reflect persisted theme on <html> at the very first render. The
	// no-flash inline script in `app.html` runs before this and we keep
	// the two in sync by re-applying the data-driven values when they
	// differ (e.g. after a navigation that mutated cookies).
	$effect(() => {
		if (typeof document === 'undefined') return;
		const root = document.documentElement;
		root.classList.remove('theme-cortex', 'theme-teal', 'theme-emerald', 'theme-amber');
		root.classList.add('theme-' + data.theme.preset);
		const wantsDark =
			data.theme.mode === 'dark' ||
			(data.theme.mode === 'system' &&
				window.matchMedia('(prefers-color-scheme: dark)').matches);
		root.classList.toggle('dark', wantsDark);
		root.classList.toggle('light', !wantsDark);
		root.setAttribute('data-mode', data.theme.mode);
		root.setAttribute('lang', data.locale);
	});

	$effect(() => {
		if (typeof document !== 'undefined') {
			document.documentElement.lang = data.locale;
		}
	});

	// The user is set by the root load and mirrored on `data.user`; the
	// shell components (nav, header) read it from `data.user` directly.
</script>

<svelte:head>
	<title>{data.theme.preset} · CortexOS</title>
	<link rel="canonical" href={page.url.href} />
</svelte:head>

{@render children()}
