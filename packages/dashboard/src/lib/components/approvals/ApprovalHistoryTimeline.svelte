<!--
  ApprovalHistoryTimeline — vertical timeline of historical approvals.

  Used by the /approvals/history page. Renders each approval row
  as a timeline entry with a status icon, the resolved decision,
  the approver, and the resolved timestamp. Most recent entries
  appear at the top.

  i18n: every visible string routes through
  `t(messages, 'approvals.*')`.
-->
<script lang="ts">
	import type { Approval } from './adapter';
	import { t, type Messages } from '$lib/i18n';
	import Badge from '$lib/components/ui/badge/Badge.svelte';
	import { statusToI18nKey, formatAge } from './adapter';

	type Props = {
		/** History rows (already filtered to non-pending). */
		approvals: readonly Approval[];
		/** Locale messages. */
		messages: Messages;
		/** Optional className passthrough. */
		class?: string;
	};

	let { approvals, messages, class: className }: Props = $props();

	function variantFor(
		status: Approval['status'],
	): 'success' | 'destructive' | 'warning' | 'info' | 'secondary' {
		switch (status) {
			case 'approved':
				return 'success';
			case 'denied':
				return 'destructive';
			case 'expired':
			case 'timeout':
				return 'warning';
			case 'pending':
				return 'info';
			case 'unknown':
				return 'secondary';
		}
	}

	/** Format an ISO timestamp for display. */
	function fmt(iso: string | null): string {
		if (!iso) return '—';
		const d = new Date(iso);
		if (Number.isNaN(d.getTime())) return '—';
		return d.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
	}
</script>

<ol
	class={['flex flex-col gap-3', className].filter(Boolean).join(' ')}
	data-slot="approval-history-timeline"
>
	{#each approvals as a (a.id)}
		<li
			class="rounded-lg border border-border bg-card p-3 text-card-foreground"
			data-slot="approval-history-item"
			data-approval-id={a.id}
			data-approval-status={a.status}
		>
			<div class="flex flex-wrap items-center gap-2">
				<Badge variant={variantFor(a.status)} size="sm">
					<span data-slot="approval-history-status">
						{t(messages, statusToI18nKey(a.status))}
					</span>
				</Badge>
				<span class="font-medium" data-slot="approval-history-signal">{a.signalName}</span>
				<span class="text-xs text-muted-foreground" data-slot="approval-history-run">
					· {a.runId}
				</span>
			</div>
			<p class="mt-1 line-clamp-2 text-sm text-muted-foreground" data-slot="approval-history-reason">
				{a.reason ?? '—'}
			</p>
			<div
				class="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground"
				data-slot="approval-history-meta"
			>
				<span data-slot="approval-history-resolved-at">
					{fmt(a.resolvedAt)}
				</span>
				<span data-slot="approval-history-approver">
					{t(messages, 'approvals.detail.fields.approver')}: {a.approver ?? '—'}
				</span>
				<span data-slot="approval-history-age">
					{formatAge(a.ageSec)}
				</span>
			</div>
		</li>
	{:else}
		<li
			class="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground"
			data-slot="approval-history-empty"
		>
			{t(messages, 'approvals.history.empty')}
		</li>
	{/each}
</ol>
