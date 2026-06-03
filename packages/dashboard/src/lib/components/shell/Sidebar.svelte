<script lang="ts">
	import { page } from '$app/state';
	import { NAV_GROUPS, type NavItem } from '$lib/nav';
	import { t, type Messages } from '$lib/i18n';
	import { cn } from '$lib/utils/cn';
	import Command from '$lib/icons/Command.svelte';

	interface Props {
		messages: Messages;
		isAdmin: boolean;
		collapsed?: boolean;
		class?: string;
	}

	let { messages, isAdmin, collapsed = false, class: className = '' }: Props = $props();

	const groups = $derived(
		NAV_GROUPS.map((g) => ({
			...g,
			items: g.items.filter((it) => (it.requiresAdmin ? isAdmin : true) && !it.hiddenInSidebar)
		}))
	);

	function isActive(href: string | null): boolean {
		if (!href) return false;
		const path = page.url.pathname;
		return path === href || path.startsWith(href + '/');
	}

	function labelOf(item: NavItem): string {
		return item.label.includes('.') ? t(messages, item.label) : item.label;
	}
</script>

<aside
	aria-label="Primary navigation"
	class={cn(
		'flex h-full flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground',
		collapsed ? 'w-14' : 'w-60',
		'transition-[width] duration-150',
		className
	)}
>
	<div class={cn('flex items-center gap-2 border-b border-sidebar-border px-3 py-3', collapsed && 'justify-center')}>
		<span class="grid h-7 w-7 place-items-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
			<Command class="h-4 w-4" />
		</span>
		{#if !collapsed}
			<div class="flex flex-col leading-tight">
				<span class="text-sm font-semibold">{t(messages, 'app.shell.title')}</span>
				<span class="text-[10px] uppercase tracking-wider text-muted-foreground">M1 foundation</span>
			</div>
		{/if}
	</div>

	<nav class="flex-1 overflow-y-auto px-2 py-3 scrollbar-thin">
		{#each groups as group (group.id)}
			{#if group.items.length}
				<div class="mb-3">
					{#if !collapsed}
						<h2 class="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
							{t(messages, group.label)}
						</h2>
					{/if}
					<ul class="flex flex-col gap-0.5">
						{#each group.items as item (item.id)}
							{@const Icon = item.icon}
							{@const active = isActive(item.href)}
							<li>
								{#if item.href}
									<a
										href={item.href}
										aria-current={active ? 'page' : undefined}
										class={cn(
											'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
											active
												? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
												: 'hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
											collapsed && 'justify-center'
										)}
										title={collapsed ? labelOf(item) : undefined}
									>
										{#if Icon}
											<Icon class="h-4 w-4 shrink-0" />
										{/if}
										{#if !collapsed}
											<span class="truncate">{labelOf(item)}</span>
											{#if item.workstream}
												<span
													class="ml-auto rounded-full border border-sidebar-border bg-sidebar px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-muted-foreground"
												>
													{item.workstream}
												</span>
											{/if}
										{/if}
									</a>
								{:else if !collapsed}
									<span
										class="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground"
										title="Coming in {item.workstream ?? 'a later milestone'}"
									>
										{#if Icon}
											<Icon class="h-4 w-4 shrink-0" />
										{/if}
										<span class="truncate">{labelOf(item)}</span>
										{#if item.workstream}
											<span
												class="ml-auto rounded-full border border-sidebar-border bg-sidebar px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-muted-foreground"
											>
												{item.workstream}
											</span>
										{/if}
									</span>
								{/if}
							</li>
						{/each}
					</ul>
				</div>
			{/if}
		{/each}
	</nav>

	<footer
		class={cn('border-t border-sidebar-border px-3 py-2 text-[10px] text-muted-foreground', collapsed && 'text-center')}
	>
		{#if collapsed}
			v0.2
		{:else}
			CortexOS · v0.2.0
		{/if}
	</footer>
</aside>
