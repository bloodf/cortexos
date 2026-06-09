<script lang="ts">
	import Button from '$lib/components/ui/button/Button.svelte';
	import Shield from '$lib/icons/Shield.svelte';
	import Flag from '$lib/icons/Flag.svelte';
	import AlertTriangle from '$lib/icons/AlertTriangle.svelte';
	import MailRiskBadge from './MailRiskBadge.svelte';
	import MailStatusBadge from './MailStatusBadge.svelte';
	import type { MailGuardianReview } from '$lib/server/db/schema';

	interface Props {
		review: MailGuardianReview | null;
		onApprove: () => void;
		onFlag: () => void;
		approving?: boolean;
		flagging?: boolean;
	}

	let {
		review,
		onApprove,
		onFlag,
		approving = false,
		flagging = false,
	}: Props = $props();

	function relativeTime(ts: Date | string | null): string {
		if (!ts) return '—';
		const d = typeof ts === 'string' ? new Date(ts) : ts;
		const sec = Math.floor((Date.now() - d.getTime()) / 1000);
		if (sec < 60) return 'just now';
		const min = Math.floor(sec / 60);
		if (min < 60) return `${min}m ago`;
		const hr = Math.floor(min / 60);
		if (hr < 24) return `${hr}h ago`;
		const day = Math.floor(hr / 24);
		return `${day}d ago`;
	}

	function statusFromReview(r: MailGuardianReview): 'pending' | 'approved' | 'flagged' {
		if (!r.resolvedAt) return 'pending';
		if (r.ownerDecision === 'keep') return 'approved';
		if (r.ownerDecision === 'spam') return 'flagged';
		return 'pending';
	}

	const status = $derived(review ? statusFromReview(review) : 'pending');
	const confidencePct = $derived(review ? Math.round((Number(review.modelConfidence) || 0) * 100) : 0);
	const risk = $derived(review ? (review.modelVerdict.toLowerCase() === 'spam' ? 'high' : review.modelVerdict.toLowerCase() === 'uncertain' ? 'medium' : 'low') : 'low');
</script>

{#if review}
	<div class="space-y-4">
		<div>
			<div class="flex flex-wrap items-baseline gap-2">
				<h2 class="text-lg font-semibold">{review.summary || 'No summary'}</h2>
				<MailRiskBadge verdict={review.modelVerdict} />
			</div>
			<p class="text-sm text-muted-foreground">
				From <span class="font-mono">{review.accountSlug}</span> · UID {review.messageUid} ·
				{relativeTime(review.requestedAt)}
			</p>
		</div>

		<div class="space-y-2">
			<div class="flex items-center justify-between text-sm">
				<span class="text-muted-foreground">Confidence</span>
				<span class="font-medium">{confidencePct}%</span>
			</div>
			<div class="h-2 w-full overflow-hidden rounded-full bg-muted">
				<div
					class="h-full transition-all"
					class:bg-success={risk === 'low'}
					class:bg-warning={risk === 'medium'}
					class:bg-destructive={risk === 'high'}
					style:width="{confidencePct}%"
				></div>
			</div>
		</div>

		<div class="space-y-1">
			<div class="flex items-center gap-2 text-sm">
				<span class="text-muted-foreground">Status</span>
				<MailStatusBadge {status} />
			</div>
			{#if review.resolvedAt}
				<p class="text-xs text-muted-foreground">
					Resolved {relativeTime(review.resolvedAt)} by {review.approver || 'unknown'}
				</p>
			{/if}
		</div>

		<div
			class="prose prose-sm max-w-none whitespace-pre-wrap rounded-lg border border-border bg-muted/30 p-4 text-sm leading-relaxed text-foreground"
		>
			{review.summary || 'No content summary available.'}
		</div>

		{#if risk === 'high'}
			<div class="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
				<AlertTriangle class="mt-0.5 size-4 shrink-0" />
				<span>High-risk message classified as spam.</span>
			</div>
		{/if}

		<div class="flex gap-2 border-t border-border pt-3">
			<Button
				variant="default"
				loading={approving}
				disabled={approving || flagging || status === 'approved'}
				onclick={onApprove}
			>
				<Shield class="mr-1.5 size-4" />
				Approve
			</Button>
			<Button
				variant="destructive"
				loading={flagging}
				disabled={approving || flagging || status === 'flagged'}
				onclick={onFlag}
			>
				<Flag class="mr-1.5 size-4" />
				Flag
			</Button>
		</div>
	</div>
{:else}
	<p class="text-sm text-muted-foreground">Select an email to review.</p>
{/if}
