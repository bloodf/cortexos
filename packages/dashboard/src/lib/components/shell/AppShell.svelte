<script lang="ts" module>
	import { fade } from 'svelte/transition';
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils/cn';
	import { t, type Messages, type Locale } from '$lib/i18n';
	import type { ThemeMode, ThemePreset } from '$lib/theme-presets';
	import Sidebar from './Sidebar.svelte';
	import TopBar from './TopBar.svelte';
	import X from '$lib/icons/X.svelte';

	interface Props {
		messages: Messages;
		locale: Locale;
		themeMode: ThemeMode;
		themePreset: ThemePreset;
		username: string | null;
		isAdmin: boolean;
		class?: string;
		children?: Snippet;
	}

	let {
		messages,
		locale = $bindable('en'),
		themeMode,
		themePreset,
		username,
		isAdmin,
		class: className = '',
		children
	}: Props = $props();

	let collapsed = $state(false);
	let mobileOpen = $state(false);
</script>

<a
	href="#main-content"
	class="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-1.5 focus:text-primary-foreground"
>
	{t(messages, 'app.shell.skipToContent')}
</a>

<div class={cn('flex h-full min-h-screen w-full bg-background text-foreground', className)}>
	<!-- Desktop sidebar -->
	<div class="hidden sm:block">
		<Sidebar {messages} {isAdmin} {collapsed} />
	</div>

	<!-- Mobile drawer -->
	{#if mobileOpen}
		<div
			class="fixed inset-0 z-40 flex sm:hidden"
			role="presentation"
			transition:fade={{ duration: 120 }}
		>
			<button
				type="button"
				aria-label={t(messages, 'app.shell.closeMenu')}
				class="absolute inset-0 bg-black/50"
				onclick={() => (mobileOpen = false)}
			></button>
			<div class="relative h-full w-64 max-w-[85vw] shadow-xl">
				<Sidebar {messages} {isAdmin} />
				<button
					type="button"
					aria-label={t(messages, 'app.shell.closeMenu')}
					class="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-md text-foreground hover:bg-accent"
					onclick={() => (mobileOpen = false)}
				>
					<X class="h-4 w-4" />
				</button>
			</div>
		</div>
	{/if}

	<div class="flex min-w-0 flex-1 flex-col">
		<TopBar
			{messages}
			bind:locale
			{themeMode}
			{themePreset}
			{username}
			{isAdmin}
			onToggleSidebar={() => (collapsed = !collapsed)}
			onOpenMobileNav={() => (mobileOpen = true)}
		/>
		<main
			id="main-content"
			tabindex={-1}
			class="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6"
		>
			{#if children}
				{@render children()}
			{/if}
		</main>
	</div>
</div>
