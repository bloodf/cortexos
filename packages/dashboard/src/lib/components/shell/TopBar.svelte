<script lang="ts">
	import { t, type Messages } from '$lib/i18n';
	import { cn } from '$lib/utils/cn';
	import ThemeSwitcher from '$lib/components/theme/ThemeSwitcher.svelte';
	import CommandPalette from '$lib/components/command-palette/CommandPalette.svelte';
	import LocaleSwitcher from '$lib/components/i18n/LocaleSwitcher.svelte';
	import Menu from '$lib/icons/Menu.svelte';
	import type { ThemeMode, ThemePreset } from '$lib/theme-presets';
	import type { Locale } from '$lib/i18n';

	interface Props {
		messages: Messages;
		locale: Locale;
		themeMode: ThemeMode;
		themePreset: ThemePreset;
		username: string | null;
		isAdmin: boolean;
		class?: string;
		onToggleSidebar?: () => void;
		onOpenMobileNav?: () => void;
	}

	let {
		messages,
		locale = $bindable('en'),
		themeMode,
		themePreset,
		username,
		isAdmin,
		class: className = '',
		onToggleSidebar,
		onOpenMobileNav
	}: Props = $props();

	function onLocaleChange(next: Locale): void {
		locale = next;
		if (typeof document !== 'undefined') {
			document.cookie = `cortex-locale=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
		}
	}
</script>

<header
	class={cn(
		'sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/80 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:gap-3 sm:px-4',
		className
	)}
>
	<button
		type="button"
		aria-label={t(messages, 'app.shell.openMenu')}
		class="inline-flex h-9 w-9 items-center justify-center rounded-md text-foreground hover:bg-accent sm:hidden"
		onclick={() => onOpenMobileNav?.()}
	>
		<Menu class="h-5 w-5" />
	</button>
	<button
		type="button"
		aria-label="Toggle sidebar"
		class="hidden h-9 w-9 items-center justify-center rounded-md text-foreground hover:bg-accent sm:inline-flex"
		onclick={() => onToggleSidebar?.()}
	>
		<Menu class="h-5 w-5" />
	</button>

	<div class="flex-1">
		<div
			class="hidden h-9 w-full max-w-md items-center gap-2 rounded-md border border-input bg-background px-3 text-sm text-muted-foreground sm:flex"
			aria-hidden="true"
		>
			<span class="text-muted-foreground">{t(messages, 'app.shell.search')}</span>
			<kbd class="ml-auto rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono">⌘K</kbd>
		</div>
	</div>

	<div class="flex items-center gap-2">
		<CommandPalette {messages} />
		<LocaleSwitcher bind:value={locale} onchange={onLocaleChange} />
		<ThemeSwitcher initialMode={themeMode} initialPreset={themePreset} />

		<div
			class="ml-1 hidden items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs sm:flex"
		>
			<span class="grid h-6 w-6 place-items-center rounded-full bg-primary text-primary-foreground">
				{username ? username.slice(0, 1).toUpperCase() : '·'}
			</span>
			<div class="flex flex-col leading-tight">
				<span class="font-medium text-foreground">{username ?? 'Guest'}</span>
				<span class="text-[10px] uppercase tracking-wide text-muted-foreground">
					{isAdmin ? 'Admin' : username ? 'User' : 'Anonymous'}
				</span>
			</div>
		</div>
	</div>
</header>
