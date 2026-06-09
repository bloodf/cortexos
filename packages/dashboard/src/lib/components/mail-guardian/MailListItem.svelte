<script lang="ts">
	import Checkbox from '$lib/components/ui/checkbox/Checkbox.svelte';
	import Button from '$lib/components/ui/button/Button.svelte';
	import Shield from '$lib/icons/Shield.svelte';
	import Flag from '$lib/icons/Flag.svelte';
	import MailRiskBadge from './MailRiskBadge.svelte';
	import MailStatusBadge from './MailStatusBadge.svelte';
	import type { MailGuardianReview } from '$lib/server/db/schema';

	interface Props {
		review: MailGuardianReview;
		isSelected: boolean;
		isPicked: boolean;
		isActive: boolean;
		onTogglePick: (checked: boolean) => void;
		onSelect: () => void;
		onApprove: (e: Event) => void;
		onFlag: (e: Event) => void;
	}

	let {
		review,
		isSelected,
		isPicked,
		isActive,
		onTogglePick,
		onSelect,
		onApprove,
		onFlag,
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

	const status = $derived(statusFromReview(review));
	const subjectSnippet = $derived(review.summary?.slice(0, 80) ?? '');
</script>

<div
	class={[
		'group flex items-start gap-2 px-3 py-2.5 transition-colors',
		isActive && 'bg-accent/50',
		isPicked && 'bg-primary/5',
		!isActive && !isPicked && 'hover:bg-muted/30',
	]}
	role="button"
	tabindex="0"
	onclick={onSelect}
	onkeydown={(e) => e.key === 'Enter' && onSelect()}
>
	<div class="pt-1" onclick={(e) => e.stopPropagation()} role="none">
		<Checkbox checked={isPicked} onchange={() => onTogglePick(!isPicked)} />
	</div>
	<button
		type="button"
		onclick={onSelect}
		class="min-w-0 flex-1 text-left"
		aria-pressed={isActive}
	>
		<div class="flex items-start justify-between gap-2">
			<div class="min-w-0 flex-1">
				<p class="text-sm font-medium truncate">{review.accountSlug}</p>
				<p class="text-sm truncate">{subjectSnippet || 'No summary'}</p>
				<p class="text-xs text-muted-foreground truncate">
					UID {review.messageUid} · {review.modelVerdict}
				</p>
			</div>
			<MailRiskBadge verdict={review.modelVerdict} size="sm" />
		</div>
		<p class="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
			<span>{relativeTime(review.requestedAt)}</span>
			<span>·</span>
			<MailStatusBadge {status} size="sm" />
		</p>
	</button>
	<div
		class="flex flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"
		onclick={(e) => e.stopPropagation()}
		role="none"
	>
		<Button
			size="icon"
			variant="outline"
			class="h-7 w-7 border-success text-success hover:bg-success/10"
			onclick={onApprove}
			aria-label="Approve"
		>
			<Shield class="size-3.5" />
		</Button>
		<Button
			size="icon"
			variant="outline"
			class="h-7 w-7 border-destructive text-destructive hover:bg-destructive/10"
			onclick={onFlag}
			aria-label="Flag"
		>
			<Flag class="size-3.5" />
		</Button>
	</div>
</div>
