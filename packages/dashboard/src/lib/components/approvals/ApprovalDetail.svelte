<!--
  ApprovalDetail — full-approval detail view.

  Renders the approval row's signal, run id, role, reason, issue,
  requested/timeout/resolved timestamps, decision, and approver.
  Optional action buttons (grant / revoke) flow in via the
  `ApprovalActionBar` snippet so the page layer can control the
  form-action wiring and the permission gating.

  i18n: every visible string routes through
  `t(messages, 'approvals.detail.*')`.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Approval } from './adapter';
	import { t, type Messages } from '$lib/i18n';
	import Card from '$lib/components/ui/card/Card.svelte';
	import CardHeader from '$lib/components/ui/card/CardHeader.svelte';
	import CardTitle from '$lib/components/ui/card/CardTitle.svelte';
	import CardBody from '$lib/components/ui/card/CardBody.svelte';
	import Badge from '$lib/components/ui/badge/Badge.svelte';
	import { formatAge, statusToI18nKey } from './adapter';

	type Props = {
		/** The approval record. The component never mutates it. */
		approval: Approval;
		/** Locale messages (from the root layout's PageData). */
		messages: Messages;
		/** Optional action bar snippet (grant / revoke form actions). */
		actions?: Snippet;
		/** Optional className passthrough. */
		class?: string;
	};

	let { approval, messages, actions, class: className }: Props = $props();

	const statusLabel = $derived(t(messages, statusToI18nKey(approval.status)));
	const ageDisplay = $derived(formatAge(approval.ageSec));

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

	/** Format an ISO timestamp for display, falling back to "—" on null/NaN. */
	function fmt(iso: string | null): string {
		if (!iso) return '—';
		const d = new Date(iso);
		if (Number.isNaN(d.getTime())) return '—';
		return d.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
	}
</script>

<Card size="default" class={className}>
	<CardHeader>
		<div class="flex items-start gap-3">
			<div class="min-w-0 flex-1">
				<CardTitle>
					<span data-slot="approval-detail-signal">{approval.signalName}</span>
				</CardTitle>
				<p class="mt-1 text-sm text-muted-foreground" data-slot="approval-detail-run">
					{t(messages, 'approvals.detail.fields.run')}: <code>{approval.runId}</code>
				</p>
			</div>
			<Badge variant={statusVariant} size="default" class="shrink-0">
				<span data-slot="approval-detail-status">{statusLabel}</span>
			</Badge>
		</div>
	</CardHeader>
	<CardBody>
		<dl
			class="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2"
			data-slot="approval-detail-fields"
		>
			<div>
				<dt class="font-medium text-muted-foreground">
					{t(messages, 'approvals.detail.fields.role')}
				</dt>
				<dd data-slot="approval-detail-role">
					{approval.role ?? '—'}
				</dd>
			</div>
			<div>
				<dt class="font-medium text-muted-foreground">
					{t(messages, 'approvals.detail.fields.issue')}
				</dt>
				<dd data-slot="approval-detail-issue">
					{approval.issueId ?? '—'}
				</dd>
			</div>
			<div class="sm:col-span-2">
				<dt class="font-medium text-muted-foreground">
					{t(messages, 'approvals.detail.fields.reason')}
				</dt>
				<dd data-slot="approval-detail-reason" class="whitespace-pre-wrap">
					{approval.reason ?? '—'}
				</dd>
			</div>
			<div>
				<dt class="font-medium text-muted-foreground">
					{t(messages, 'approvals.detail.fields.requestedAt')}
				</dt>
				<dd data-slot="approval-detail-requested-at">
					{fmt(approval.requestedAt)}
					<span class="text-muted-foreground"> ({ageDisplay})</span>
				</dd>
			</div>
			<div>
				<dt class="font-medium text-muted-foreground">
					{t(messages, 'approvals.detail.fields.timeoutAt')}
				</dt>
				<dd data-slot="approval-detail-timeout-at">{fmt(approval.timeoutAt)}</dd>
			</div>
			<div>
				<dt class="font-medium text-muted-foreground">
					{t(messages, 'approvals.detail.fields.resolvedAt')}
				</dt>
				<dd data-slot="approval-detail-resolved-at">{fmt(approval.resolvedAt)}</dd>
			</div>
			<div>
				<dt class="font-medium text-muted-foreground">
					{t(messages, 'approvals.detail.fields.decision')}
				</dt>
				<dd data-slot="approval-detail-decision">
					{approval.decision ?? '—'}
				</dd>
			</div>
			<div>
				<dt class="font-medium text-muted-foreground">
					{t(messages, 'approvals.detail.fields.approver')}
				</dt>
				<dd data-slot="approval-detail-approver">
					{approval.approver ?? '—'}
				</dd>
			</div>
		</dl>

		{#if actions}
			<div class="mt-6" data-slot="approval-detail-actions">
				{@render actions()}
			</div>
		{/if}
	</CardBody>
</Card>
