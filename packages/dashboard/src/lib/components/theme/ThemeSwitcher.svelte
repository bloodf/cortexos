<script lang="ts">
	import {
		DEFAULT_PRESET,
		MODE_COOKIE,
		PRESET_COOKIE,
		PRESETS,
		PRESET_CLASSES,
		presetClass,
		COOKIE_MAX_AGE as MAX_AGE,
		isMode,
		isPreset,
		type ThemeMode,
		type ThemePreset
	} from '$lib/theme-presets';
	import { browser } from '$app/environment';
	import Sun from '$lib/icons/Sun.svelte';
	import Moon from '$lib/icons/Moon.svelte';

	interface Props {
		initialMode: ThemeMode;
		initialPreset: ThemePreset;
		class?: string;
	}

	let { initialMode, initialPreset, class: className = '' }: Props = $props();

	let mode = $state<ThemeMode>(initialMode);
	let preset = $state<ThemePreset>(initialPreset);
	let resolvedDark = $state(false);

	$effect(() => {
		if (!browser) return;
		const root = document.documentElement;
		const wantsDark = mode === 'dark' || (mode === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
		resolvedDark = wantsDark;
		root.classList.toggle('dark', wantsDark);
		root.classList.toggle('light', !wantsDark);
		root.setAttribute('data-mode', mode);
	});

	$effect(() => {
		if (!browser) return;
		const root = document.documentElement;
		for (const cls of PRESET_CLASSES) root.classList.remove(cls);
		root.classList.add(presetClass(preset));
	});

	function setMode(next: ThemeMode): void {
		mode = next;
		if (browser) {
			document.cookie = `${MODE_COOKIE}=${next}; path=/; max-age=${MAX_AGE}; samesite=lax`;
		}
	}

	function setPreset(next: ThemePreset): void {
		preset = next;
		if (browser) {
			document.cookie = `${PRESET_COOKIE}=${next}; path=/; max-age=${MAX_AGE}; samesite=lax`;
		}
	}

	function onPresetChange(e: Event): void {
		const next = (e.currentTarget as HTMLSelectElement).value;
		if (isPreset(next)) setPreset(next);
	}
</script>

<div class={'flex items-center gap-1 ' + className} role="group" aria-label="Theme">
	<button
		type="button"
		aria-label="Toggle theme"
		aria-pressed={resolvedDark}
		class="inline-flex h-9 w-9 items-center justify-center rounded-md border border-input bg-background text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
		onclick={() => setMode(resolvedDark ? 'light' : 'dark')}
	>
		{#if resolvedDark}
			<Sun class="h-4 w-4" />
		{:else}
			<Moon class="h-4 w-4" />
		{/if}
	</button>
	<label class="sr-only" for="theme-preset">Brand preset</label>
	<select
		id="theme-preset"
		class="h-9 rounded-md border border-input bg-background px-2 text-sm"
		value={preset}
		onchange={onPresetChange}
	>
		{#each PRESETS as p (p)}
			<option value={p}>{p}</option>
		{/each}
	</select>
	{#if mode === 'system'}
		<span class="sr-only" aria-live="polite">Theme follows system</span>
	{/if}
	<span class="sr-only">Current preset: {preset || DEFAULT_PRESET}, mode: {isMode(mode) ? mode : 'system'}</span>
</div>
