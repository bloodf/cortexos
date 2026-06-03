<script lang="ts">
	import type { Component, Snippet } from 'svelte';
	import { cn } from '$lib/utils/cn';

	interface Breadcrumb {
		label: string;
		href?: string;
	}

	interface Props {
		class?: string;
		title: string;
		description?: string;
		icon?: Component;
		breadcrumbs?: readonly Breadcrumb[];
		actions?: Snippet;
	}

	let {
		class: className = '',
		title,
		description,
		icon: IconComp,
		breadcrumbs = [],
		actions
	}: Props = $props();
</script>

<header
	class={cn(
		'flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between',
		className
	)}
>
	<div class="flex flex-col gap-2">
		{#if breadcrumbs.length}
			<nav aria-label="Breadcrumb" class="text-xs text-muted-foreground">
				<ol class="flex flex-wrap items-center gap-1">
					{#each breadcrumbs as crumb, i (crumb.label)}
						<li class="flex items-center gap-1">
							{#if crumb.href && i < breadcrumbs.length - 1}
								<a class="hover:text-foreground" href={crumb.href}>{crumb.label}</a>
								<span aria-hidden="true">/</span>
							{:else}
								<span class="text-foreground">{crumb.label}</span>
							{/if}
						</li>
					{/each}
				</ol>
			</nav>
		{/if}
		<div class="flex items-center gap-2">
			{#if IconComp}
				<IconComp class="h-5 w-5 text-muted-foreground" />
			{/if}
			<h1 class="text-2xl font-semibold leading-none tracking-tight">{title}</h1>
		</div>
		{#if description}
			<p class="text-sm text-muted-foreground">{description}</p>
		{/if}
	</div>
	{#if actions}
		<div class="flex items-center gap-2">
			{@render actions()}
		</div>
	{/if}
</header>
