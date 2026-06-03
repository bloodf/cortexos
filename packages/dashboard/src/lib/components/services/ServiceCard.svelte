<!--
  ServiceCard — single-service card built on the design-system Card.

  Used in the Services overview (grid) and the dashboard widgets.
  The card is non-interactive on its own; navigation is provided by
  passing an `onSelect` handler. This keeps the component reusable
  inside non-link surfaces (e.g. embedded widgets that trigger a
  side panel).

  Required props are typed against @cortexos/contracts so misuse
  (e.g. passing a ServiceCheck with a missing field) is a compile
  error at the call site.

  i18n: pass the locale `messages` map (from `$lib/i18n`) and every
  visible string routes through `t(messages, 'services.*')`.
-->
<script lang="ts">
	import type { Service } from '@cortexos/contracts';
	import { t, type Messages } from '$lib/i18n';
	import Card from '$lib/components/ui/card/Card.svelte';
	import CardHeader from '$lib/components/ui/card/CardHeader.svelte';
	import CardTitle from '$lib/components/ui/card/CardTitle.svelte';
	import CardDescription from '$lib/components/ui/card/CardDescription.svelte';
	import CardBody from '$lib/components/ui/card/CardBody.svelte';
	import CardFooter from '$lib/components/ui/card/CardFooter.svelte';
	import Badge from '$lib/components/ui/badge/Badge.svelte';
	import ServiceHealthBadge from './ServiceHealthBadge.svelte';
	import type { ServiceStatusLit } from './adapter';

	type Props = {
		/** The full service record. The component never mutates it. */
		service: Service;
		/** Locale messages (from the root layout's PageData). */
		messages: Messages;
		/** Optional click handler (e.g. `navigate('/services/${slug}')`). */
		onSelect?: (service: Service) => void;
		/** Optional className passthrough for layout grids. */
		class?: string;
	};

	let { service, messages, onSelect, class: className }: Props = $props();

	/** Pre-formatted response time string, e.g. `42ms` or `—`. */
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

	/** Icon monogram — first 1-2 characters of the slug, upper-cased. */
	const monogram = $derived.by(() => {
		const slug = service.slug ?? '';
		if (!slug) return '?';
		const cleaned = slug.replace(/[^a-z0-9]/gi, '');
		return cleaned.slice(0, 2).toUpperCase() || '?';
	});

	const iconColor = $derived(service.icon?.color ?? '#1f2937');

	// i18n strings resolved once per render. The `messages` prop
	// flows from the root layout, so a locale change re-renders the
	// whole tree.
	const ariaResponse = $derived(t(messages, 'services.detail.fields.responseTime'));
	const ariaUptime = $derived(t(messages, 'services.detail.fields.uptime'));

	function handleClick(): void {
		if (onSelect) onSelect(service);
	}

	function handleKey(event: KeyboardEvent): void {
		if (!onSelect) return;
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			onSelect(service);
		}
	}
</script>

<!--
  Card is the visual surface; the inner button is the interactive
  region so the entire card is one large click target without
  nesting `<button>` inside `<button>` or `<a>`.
-->
<Card size="default" class={className}>
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<div
		role={onSelect ? 'button' : undefined}
		tabindex={onSelect ? 0 : undefined}
		data-slot="service-card"
		data-service-slug={service.slug}
		onclick={handleClick}
		onkeydown={handleKey}
		class="flex h-full cursor-pointer flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
	>
		<CardHeader>
			<div class="flex items-start gap-3">
				<div
					data-slot="service-icon"
					aria-hidden="true"
					class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
					style:background-color={iconColor}
				>
					{monogram}
				</div>
				<div class="min-w-0 flex-1">
					<CardTitle>{service.name}</CardTitle>
					<CardDescription>
						<span class="line-clamp-1">{service.category}</span>
					</CardDescription>
				</div>
				<ServiceHealthBadge
					{messages}
					status={service.status as ServiceStatusLit}
					size="sm"
				/>
			</div>
		</CardHeader>
		<CardBody>
			{#if service.description}
				<p class="line-clamp-2 text-sm text-muted-foreground">{service.description}</p>
			{/if}
		</CardBody>
		<CardFooter>
			<div class="flex w-full items-center justify-between gap-2 text-xs text-muted-foreground">
				<span data-slot="service-response" aria-label={ariaResponse}>
					{responseDisplay}
				</span>
				{#if uptimeDisplay != null}
					<span data-slot="service-uptime" aria-label={ariaUptime}>
						{uptimeDisplay} 24h
					</span>
				{/if}
				{#if service.badges.length > 0}
					<div class="flex items-center gap-1">
						{#each service.badges.slice(0, 2) as badge (badge.slug)}
							<Badge variant="outline" size="sm">{badge.label}</Badge>
						{/each}
					</div>
				{/if}
			</div>
		</CardFooter>
	</div>
</Card>
