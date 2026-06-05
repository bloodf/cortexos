<script lang="ts">
	import type { PageData } from './$types';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import Card from '$lib/components/ui/card/Card.svelte';
	import CardHeader from '$lib/components/ui/card/CardHeader.svelte';
	import CardTitle from '$lib/components/ui/card/CardTitle.svelte';
	import CardDescription from '$lib/components/ui/card/CardDescription.svelte';
	import CardBody from '$lib/components/ui/card/CardBody.svelte';
	import CardFooter from '$lib/components/ui/card/CardFooter.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Container from '$lib/icons/Container.svelte';
	import PlugZap from '$lib/icons/PlugZap.svelte';
	import { t } from '$lib/i18n';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	const title = $derived(t(data.messages, 'app.nav.apps'));
	const pageTitle = $derived(t(data.messages, 'apps.title'));
	const pageDescription = $derived(t(data.messages, 'apps.description'));
	const openLabel = $derived(t(data.messages, 'apps.openInNewTab'));
	const emptyTitle = $derived(t(data.messages, 'apps.empty.title'));
	const emptyDescription = $derived(t(data.messages, 'apps.empty.description'));
</script>

<svelte:head>
	<title>{pageTitle} · CortexOS</title>
</svelte:head>

<div class="flex flex-col gap-6">
	<PageHeader
		title={pageTitle}
		description={pageDescription}
		icon={Container}
	/>

	{#if data.launchers.length === 0}
		<EmptyState
			title={emptyTitle}
			description={emptyDescription}
			icon={Container}
		/>
	{:else}
		<div
			class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
			data-testid="apps-launcher-grid"
		>
			{#each data.launchers as launcher (launcher.id)}
				<Card data-testid="apps-launcher-card-{launcher.slug}">
					<CardHeader>
						<CardTitle>{launcher.name}</CardTitle>
						<CardDescription>
							{launcher.description ?? t(data.messages, 'apps.noDescription')}
						</CardDescription>
					</CardHeader>
					<CardBody>
						<div class="flex flex-col gap-1 text-xs text-muted-foreground">
							<div>
								<span class="font-mono">{launcher.openUrl}</span>
							</div>
						</div>
					</CardBody>
					<CardFooter>
						<Button
							variant="default"
							size="sm"
							href={launcher.openUrl ?? '#'}
							ariaLabel={`${openLabel} — ${launcher.name}`}
						>
							<PlugZap class="h-4 w-4" />
							<span>{openLabel}</span>
						</Button>
					</CardFooter>
				</Card>
			{/each}
		</div>
	{/if}
</div>
