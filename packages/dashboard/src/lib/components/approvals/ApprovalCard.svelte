<!--
  ApprovalCard — single-approval card built on the design-system Card.

  Used in the Approvals overview list (grid) and the dashboard widgets.
  Mirrors the M2 services card pattern: non-interactive by default;
  navigation is provided via an `onSelect` handler so the component
  stays reusable inside non-link surfaces (e.g. embedded widgets that
  open a side panel).

  Required props are typed against the UI-friendly `Approval` shape
  exported from `./adapter`. The server's `PendingApproval` row is
  adapted at the page layer, so misuse (e.g. passing a row with
  missing `signalName`) is a compile error at the call site.

  i18n: every visible string routes through
  `t(messages, 'approvals.*')`.
-->
<script lang="ts">
	import type { Approval } from './adapter';
	import { t, type Messages } from '$lib/i18n';
	import Card from '$lib/components/ui/card/Card.svelte';
	import CardHeader from '$lib/components/ui/card/CardHeader.svelte';
	import CardTitle from '$lib/components/ui/card/CardTitle.svelte';
	import CardDescription from '$lib/components/ui/card/CardDescription.svelte';
	import CardBody from '$lib/components/ui/card/CardBody.svelte';
	import CardFooter from '$lib/components/ui/card/CardFooter.svelte';
	import Badge from '$lib/components/ui/badge/Badge.svelte';
	import { formatAge, statusToI18nKey } from './adapter';

	type Props = {
		/** The approval record. The component never mutates it. */
		approval: Approval;
		/** Locale messages (from the root layout's PageData). */
		messages: Messages;
		/** Optional click handler (e.g. `navigate('/approvals/${id}')`). */
		onSelect?: (approval: Approval) => void;
		/** Optional className passthrough for layout grids. */
		class?: string;
	};

	let { approval, messages, onSelect, class: className }: Props = $props();

	const statusLabel = $derived(t(messages, statusToI18nKey(approval.status)));
	const ageDisplay = $derived(formatAge(approval.ageSec));
	const ariaStatus = $derived(t(messages, 'approvals.detail.fields.decision'));
	const ariaAge = $derived(t(messages, 'approvals.list.columns.age'));

	/** Variant for the status badge. */
	const statusVariant = $derived.by(() => {
		switch (approval.status) {
			case 'approved':
				return 'success' as const;
			case 'denied':
				return 'destructive' as const;
			case 'expired':
			case 'timeout':
				return 'warning' as const;
			case 'pending':
				return 'info' as const;
			case 'unknown':
				return 'secondary' as const;
		}
	});

	function handleClick(): void {
		if (onSelect) onSelect(approval);
	}

	function handleKey(event: KeyboardEvent): void {
		if (!onSelect) return;
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			onSelect(approval);
		}
	}
</script>

<Card size="default" class={className}>
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<div
		role={onSelect ? 'button' : undefined}
		tabindex={onSelect ? 0 : undefined}
		data-slot="approval-card"
		data-approval-id={approval.id}
		data-approval-status={approval.status}
		onclick={handleClick}
		onkeydown={handleKey}
		class="flex h-full cursor-pointer flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
	>
		<CardHeader>
			<div class="flex items-start gap-3">
				<div class="min-w-0 flex-1">
					<CardTitle>
						<span class="line-clamp-1" data-slot="approval-signal">
							{approval.signalName}
						</span>
					</CardTitle>
					<CardDescription>
						<span class="line-clamp-1" data-slot="approval-run">
							{approval.runId}
						</span>
					</CardDescription>
				</div>
				<Badge variant={statusVariant} size="sm" class="shrink-0">
					<span data-slot="approval-status">{statusLabel}</span>
				</Badge>
			</div>
		</CardHeader>
		<CardBody>
			{#if approval.reason}
				<p class="line-clamp-2 text-sm text-muted-foreground" data-slot="approval-reason">
					{approval.reason}
				</p>
			{:else}
				<p class="text-sm italic text-muted-foreground" data-slot="approval-reason-empty">
					—
				</p>
			{/if}
		</CardBody>
		<CardFooter>
			<div class="flex w-full items-center justify-between gap-2 text-xs text-muted-foreground">
				<span data-slot="approval-age" aria-label={ariaAge}>{ageDisplay}</span>
				<span data-slot="approval-status-label" aria-label={ariaStatus}>
					{statusLabel}
				</span>
			</div>
		</CardFooter>
	</div>
</Card>
