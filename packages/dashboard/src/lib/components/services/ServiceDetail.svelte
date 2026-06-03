<!--
  ServiceDetail — single-service detail view.

  Composed of three sections:
    1. Header — name, category, status badge, badges, description.
    2. Health — current response time, uptime, last-check timestamp,
       and a "Recheck" affordance that POSTs to /services/[id]/health.
    3. History — the last N health snapshots (most recent first), as
       a small table.
    4. Config — health URL, kind, open URL, env source.

  The component is presentational; data fetching lives in
  +page.server.ts. The "Recheck" button posts via the form action
  so the page refetches without a full reload.

  i18n: every visible string routes through t(messages, ...).
-->
<script lang="ts">
	import type { Service, ServiceHealthSnapshot } from '@cortexos/contracts';
	import { t, type Messages } from '$lib/i18n';
	import Card from '$lib/components/ui/card/Card.svelte';
	import CardHeader from '$lib/components/ui/card/CardHeader.svelte';
	import CardTitle from '$lib/components/ui/card/CardTitle.svelte';
	import CardDescription from '$lib/components/ui/card/CardDescription.svelte';
	import CardBody from '$lib/components/ui/card/CardBody.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Badge from '$lib/components/ui/badge/Badge.svelte';
	import ServiceHealthBadge from './ServiceHealthBadge.svelte';
	import type { ServiceStatusLit } from './adapter';

	type Props = {
		/** The service record. */
		service: Service;
		/** Recent health snapshots, newest first. May be empty. */
		history: readonly ServiceHealthSnapshot[];
		/** Locale messages (from the root layout's PageData). */
		messages: Messages;
		/** Fires when the user clicks "Recheck now". */
		onRecheck?: () => void;
		/** Whether the recheck action is in flight. */
		rechecking?: boolean;
		/** Optional className passthrough. */
		class?: string;
	};

	let { service, history, messages, onRecheck, rechecking = false, class: className }: Props =
		$props();

	/** Pre-formatted response time, e.g. `42ms` or `—`. */
	const responseDisplay = $derived.by(() => {
		if (service.responseMs == null) return '—';
		if (service.responseMs < 1000) return `${service.responseMs}ms`;
		return `${(service.responseMs / 1000).toFixed(2)}s`;
	});

	/** Pre-formatted uptime string. */
	const uptimeDisplay = $derived.by(() => {
		if (service.uptime24h == null) return null;
		return `${service.uptime24h.toFixed(2)}%`;
	});

	/** Localized timestamp of the last probe. */
	const lastCheckDisplay = $derived.by(() => {
		if (!service.lastCheckAt) return '—';
		try {
			return new Date(service.lastCheckAt).toLocaleString();
		} catch {
			return service.lastCheckAt;
		}
	});

	/** Icon monogram (first 1-2 chars of the slug). */
	const monogram = $derived.by(() => {
		const slug = service.slug ?? '';
		const cleaned = slug.replace(/[^a-z0-9]/gi, '');
		return cleaned.slice(0, 2).toUpperCase() || '?';
	});

	const iconColor = $derived(service.icon?.color ?? '#1f2937');

	function formatSnapshotTime(iso: string): string {
		try {
			return new Date(iso).toLocaleString();
		} catch {
			return iso;
		}
	}

	// i18n strings — resolve once per render. The whole tree
	// re-renders when the locale changes (the `messages` prop flows
	// from the root layout).
	const recheckLabel = $derived(t(messages, 'services.detail.recheck'));
	const recheckAria = $derived(t(messages, 'services.detail.recheck'));

	const healthTitle = $derived(t(messages, 'services.detail.health'));
	const healthDesc = $derived(t(messages, 'services.detail.healthDescription'));
	const configTitle = $derived(t(messages, 'services.detail.config'));
	const configDesc = $derived(t(messages, 'services.detail.configDescription'));
	const historyTitle = $derived(t(messages, 'services.detail.history'));
	const historyDesc = $derived(t(messages, 'services.detail.historyDescription'));
	const historyEmpty = $derived(t(messages, 'services.detail.historyEmpty'));

	const fieldResponse = $derived(t(messages, 'services.detail.fields.responseTime'));
	const fieldUptime = $derived(t(messages, 'services.detail.fields.uptime'));
	const fieldLastCheck = $derived(t(messages, 'services.detail.fields.lastCheck'));
	const fieldProbeType = $derived(t(messages, 'services.detail.fields.probeType'));
	const fieldSlug = $derived(t(messages, 'services.detail.fields.slug'));
	const fieldKind = $derived(t(messages, 'services.detail.fields.kind'));
	const fieldHealthUrl = $derived(t(messages, 'services.detail.fields.healthUrl'));
	const fieldOpenUrl = $derived(t(messages, 'services.detail.fields.openUrl'));
	const fieldEnvSource = $derived(t(messages, 'services.detail.fields.envSource'));

	// History table column headers
	const colWhen = $derived(t(messages, 'services.status.label'));
	const colStatus = $derived(t(messages, 'services.table.status'));
	const colLatency = $derived(t(messages, 'services.table.response'));

	// Pluralize "probe(s)" based on the snapshot count. The JSON keys
	// are static; we concatenate a small suffix so the count is the
	// only number that varies.
	const historyCountDesc = $derived(historyDesc.replace('{count}', String(history.length)));
</script>

<div data-slot="service-detail" class={`flex flex-col gap-6 ${className ?? ''}`}>
	<!-- Header -->
	<Card>
		<div class="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
			<div class="flex items-start gap-4">
				<div
					data-slot="service-icon"
					aria-hidden="true"
					class="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-lg font-bold text-white"
					style:background-color={iconColor}
				>
					{monogram}
				</div>
				<div class="min-w-0 flex-1">
					<div class="flex flex-wrap items-center gap-2">
						<h1 class="text-xl font-semibold leading-tight">{service.name}</h1>
						<ServiceHealthBadge
							{messages}
							status={service.status as ServiceStatusLit}
						/>
					</div>
					<CardDescription>
						<span class="text-sm">{service.category}</span>
						{#if service.description}
							<span class="ml-2">· {service.description}</span>
						{/if}
					</CardDescription>
					{#if service.badges.length > 0}
						<div class="mt-2 flex flex-wrap gap-1">
							{#each service.badges as badge (badge.slug)}
								<Badge variant="outline" size="sm">{badge.label}</Badge>
							{/each}
						</div>
					{/if}
				</div>
			</div>
			{#if onRecheck}
				<Button
					variant="default"
					size="md"
					onclick={onRecheck}
					loading={rechecking}
					ariaLabel={recheckAria}
				>
					{recheckLabel}
				</Button>
			{/if}
		</div>
	</Card>

	<!-- Health + Config grid -->
	<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
		<Card>
			<CardHeader>
				<CardTitle>{healthTitle}</CardTitle>
				<CardDescription>{healthDesc}</CardDescription>
			</CardHeader>
			<CardBody>
				<dl class="grid grid-cols-2 gap-y-2 text-sm">
					<dt class="text-muted-foreground">{fieldResponse}</dt>
					<dd data-slot="service-response">{responseDisplay}</dd>
					<dt class="text-muted-foreground">{fieldUptime}</dt>
					<dd data-slot="service-uptime">{uptimeDisplay ?? '—'}</dd>
					<dt class="text-muted-foreground">{fieldLastCheck}</dt>
					<dd data-slot="service-last-check">{lastCheckDisplay}</dd>
					<dt class="text-muted-foreground">{fieldProbeType}</dt>
					<dd>{service.healthType}</dd>
				</dl>
			</CardBody>
		</Card>

		<Card>
			<CardHeader>
				<CardTitle>{configTitle}</CardTitle>
				<CardDescription>{configDesc}</CardDescription>
			</CardHeader>
			<CardBody>
				<dl class="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-2 text-sm">
					<dt class="text-muted-foreground">{fieldSlug}</dt>
					<dd class="font-mono text-xs">{service.slug}</dd>
					<dt class="text-muted-foreground">{fieldKind}</dt>
					<dd>{service.kind}</dd>
					<dt class="text-muted-foreground">{fieldHealthUrl}</dt>
					<dd class="break-all font-mono text-xs">{service.healthUrl}</dd>
					{#if service.openUrl}
						<dt class="text-muted-foreground">{fieldOpenUrl}</dt>
						<dd class="break-all">
							<a
								href={service.openUrl}
								target="_blank"
								rel="noopener noreferrer"
								class="text-primary underline-offset-2 hover:underline"
							>
								{service.openUrl}
							</a>
						</dd>
					{/if}
					{#if service.envSource}
						<dt class="text-muted-foreground">{fieldEnvSource}</dt>
						<dd class="break-all font-mono text-xs">{service.envSource}</dd>
					{/if}
				</dl>
			</CardBody>
		</Card>
	</div>

	<!-- History -->
	<Card>
		<CardHeader>
			<CardTitle>{historyTitle}</CardTitle>
			<CardDescription>{historyCountDesc}</CardDescription>
		</CardHeader>
		<CardBody>
			{#if history.length === 0}
				<p class="text-sm text-muted-foreground">{historyEmpty}</p>
			{:else}
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b text-left text-xs uppercase text-muted-foreground">
								<th class="py-2 pr-4 font-medium">{colWhen}</th>
								<th class="py-2 pr-4 font-medium">{colStatus}</th>
								<th class="py-2 pr-4 font-medium">{colLatency}</th>
								<th class="py-2 font-medium">&nbsp;</th>
							</tr>
						</thead>
						<tbody>
							{#each history as snap (snap.id)}
								<tr class="border-b last:border-b-0" data-slot="service-history-row">
									<td class="py-2 pr-4">{formatSnapshotTime(snap.checkedAt)}</td>
									<td class="py-2 pr-4">
										<ServiceHealthBadge
											{messages}
											status={snap.status as ServiceStatusLit}
											size="sm"
										/>
									</td>
									<td class="py-2 pr-4 text-muted-foreground">
										{snap.latencyMs == null ? '—' : `${snap.latencyMs}ms`}
									</td>
									<td class="py-2 text-muted-foreground">{snap.note ?? ''}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</CardBody>
	</Card>
</div>
