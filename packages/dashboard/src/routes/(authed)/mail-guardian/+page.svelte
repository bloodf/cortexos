<script lang="ts">
	import type { PageData } from './$types';
	import { t } from '$lib/i18n';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Checkbox from '$lib/components/ui/checkbox/Checkbox.svelte';
	import Button from '$lib/components/ui/button/Button.svelte';
	import Input from '$lib/components/ui/input/Input.svelte';
	import Select from '$lib/components/ui/Select.svelte';
	import Mail from '$lib/icons/Mail.svelte';
	import CheckCheck from '$lib/icons/CheckCheck.svelte';
	import Flag from '$lib/icons/Flag.svelte';
	import X from '$lib/icons/X.svelte';
	import MailListItem from '$lib/components/mail-guardian/MailListItem.svelte';
	import MailReadingPane from '$lib/components/mail-guardian/MailReadingPane.svelte';
	import MailAccountsPanel from '$lib/components/mail-guardian/MailAccountsPanel.svelte';
	import type { MailGuardianReview } from '$lib/server/db/schema';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	let reviews = $state<MailGuardianReview[]>([]);
	let selectedId = $state<number | null>(null);

	$effect(() => {
		reviews = data.reviews ?? [];
	});
	$effect(() => {
		selectedId = reviews[0]?.id ?? null;
	});
	let picked = $state<Set<number>>(new Set());
	let search = $state('');
	let statusFilter = $state<'all' | 'pending' | 'resolved'>('all');
	let riskFilter = $state<'all' | 'low' | 'medium' | 'high'>('all');
	let approvingIds = $state<Set<number>>(new Set());
	let flaggingIds = $state<Set<number>>(new Set());
	let approvingBatch = $state(false);
	let flaggingBatch = $state(false);

	const filteredReviews = $derived(
		reviews.filter((r) => {
			const matchesSearch =
				search.trim() === '' ||
				r.accountSlug.toLowerCase().includes(search.toLowerCase()) ||
				(r.summary ?? '').toLowerCase().includes(search.toLowerCase());
			const status = !r.resolvedAt ? 'pending' : r.ownerDecision === 'keep' ? 'approved' : r.ownerDecision === 'spam' ? 'flagged' : 'pending';
			const matchesStatus = statusFilter === 'all' || status === statusFilter;
			const risk = r.modelVerdict.toLowerCase() === 'spam' ? 'high' : r.modelVerdict.toLowerCase() === 'uncertain' ? 'medium' : 'low';
			const matchesRisk = riskFilter === 'all' || risk === riskFilter;
			return matchesSearch && matchesStatus && matchesRisk;
		}),
	);

	const activeReview = $derived(filteredReviews.find((r) => r.id === selectedId) ?? filteredReviews[0] ?? null);

	const filteredIds = $derived(filteredReviews.map((r) => r.id));
	const pickedFilteredCount = $derived(Array.from(picked).filter((id) => filteredIds.includes(id)).length);
	const allChecked = $derived(filteredIds.length > 0 && pickedFilteredCount === filteredIds.length);
	const someChecked = $derived(pickedFilteredCount > 0 && !allChecked);

	function setLocalStatus(id: number, status: 'approved' | 'flagged') {
		reviews = reviews.map((r) =>
			r.id === id
				? {
						...r,
						resolvedAt: new Date(),
						ownerDecision: status === 'approved' ? 'keep' : 'spam',
						approver: 'dashboard',
					}
				: r,
		);
	}

	function togglePick(id: number, checked: boolean) {
		const next = new Set(picked);
		if (checked) next.add(id);
		else next.delete(id);
		picked = next;
	}

	function toggleAll(checked: boolean) {
		const next = new Set(picked);
		for (const id of filteredIds) {
			if (checked) next.add(id);
			else next.delete(id);
		}
		picked = next;
	}

	async function approveOne(id: number) {
		if (approvingIds.has(id)) return;
		approvingIds = new Set(approvingIds).add(id);
		try {
			const res = await fetch(`/api/mail-guardian/${id}/approve`, { method: 'POST', credentials: 'include' });
			if (!res.ok) throw new Error(await res.text());
			setLocalStatus(id, 'approved');
		} finally {
			const next = new Set(approvingIds);
			next.delete(id);
			approvingIds = next;
		}
	}

	async function flagOne(id: number) {
		if (flaggingIds.has(id)) return;
		flaggingIds = new Set(flaggingIds).add(id);
		try {
			const res = await fetch(`/api/mail-guardian/${id}/flag`, { method: 'POST', credentials: 'include' });
			if (!res.ok) throw new Error(await res.text());
			setLocalStatus(id, 'flagged');
		} finally {
			const next = new Set(flaggingIds);
			next.delete(id);
			flaggingIds = next;
		}
	}

	async function batchAction(action: 'approve' | 'flag') {
		const ids = Array.from(picked).filter((id) => {
			const r = reviews.find((x) => x.id === id);
			if (!r) return false;
			const status = !r.resolvedAt ? 'pending' : r.ownerDecision === 'keep' ? 'approved' : r.ownerDecision === 'spam' ? 'flagged' : 'pending';
			return status === 'pending';
		});
		if (ids.length === 0) return;
		if (action === 'approve') approvingBatch = true;
		else flaggingBatch = true;
		try {
			const res = await fetch('/api/mail-guardian/batch', {
				method: 'POST',
				credentials: 'include',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ ids, action }),
			});
			if (!res.ok) throw new Error(await res.text());
			for (const id of ids) {
				setLocalStatus(id, action === 'approve' ? 'approved' : 'flagged');
			}
			picked = new Set();
		} finally {
			approvingBatch = false;
			flaggingBatch = false;
		}
	}

	const pendingCount = $derived(reviews.filter((r) => !r.resolvedAt).length);
	const highRiskCount = $derived(
		reviews.filter((r) => r.modelVerdict.toLowerCase() === 'spam').length,
	);
</script>

<svelte:head>
	<title>{t(data.messages, 'mailGuardian.title')} · CortexOS</title>
</svelte:head>

<div class="flex flex-col gap-5">
	<PageHeader
		title={t(data.messages, 'mailGuardian.title')}
		description={t(data.messages, 'mailGuardian.description').replace('{pending}', String(pendingCount)).replace('{highRisk}', String(highRiskCount))}
		icon={Mail}
	/>

	<div class="grid gap-4 lg:grid-cols-[420px_1fr]">
		<Card class="overflow-hidden p-0">
			{#snippet children()}
				<div class="flex flex-col">
					<!-- Batch toolbar -->
					<div class="flex items-center gap-2 border-b border-border bg-muted/20 px-3 py-2">
						<label class="flex items-center" title={t(data.messages, 'mailGuardian.selectAll')}>
							<Checkbox
								checked={allChecked ? true : someChecked ? true : false}
								onchange={() => toggleAll(!allChecked)}
							/>
						</label>
						{#if pickedFilteredCount > 0}
							<span class="text-xs text-muted-foreground">
								{t(data.messages, 'mailGuardian.selectedCount').replace('{count}', String(pickedFilteredCount))}
							</span>
							<div class="ml-auto flex items-center gap-1">
								<Button
									size="sm"
									variant="default"
									loading={approvingBatch}
									disabled={approvingBatch || flaggingBatch}
									onclick={() => batchAction('approve')}
								>
									<CheckCheck class="mr-1 size-3.5" />
									{t(data.messages, 'mailGuardian.approveSelected').replace('{count}', String(pickedFilteredCount))}
								</Button>
								<Button
									size="sm"
									variant="destructive"
									loading={flaggingBatch}
									disabled={approvingBatch || flaggingBatch}
									onclick={() => batchAction('flag')}
								>
									<Flag class="mr-1 size-3.5" />
									{t(data.messages, 'mailGuardian.flagSelected').replace('{count}', String(pickedFilteredCount))}
								</Button>
								<Button
									size="sm"
									variant="ghost"
									disabled={approvingBatch || flaggingBatch}
									onclick={() => (picked = new Set())}
									aria-label={t(data.messages, 'mailGuardian.clearSelection')}
								>
									<X class="size-3.5" />
								</Button>
							</div>
						{:else}
							<span class="text-xs text-muted-foreground">
								{t(data.messages, 'mailGuardian.selectHint')}
							</span>
						{/if}
					</div>

					<!-- Filters -->
					<div class="flex items-center gap-2 border-b border-border px-3 py-2">
						<Input
							type="search"
							placeholder={t(data.messages, 'mailGuardian.searchPlaceholder')}
							class="h-7 text-xs"
							bind:value={search}
						/>
						<Select
							class="h-7 text-xs"
							bind:value={statusFilter}
							options={[
								{ value: 'all', label: t(data.messages, 'mailGuardian.statusAll') },
								{ value: 'pending', label: t(data.messages, 'mailGuardian.statusPending') },
								{ value: 'resolved', label: t(data.messages, 'mailGuardian.statusResolved') },
							]}
						/>
						<Select
							class="h-7 text-xs"
							bind:value={riskFilter}
							options={[
								{ value: 'all', label: t(data.messages, 'mailGuardian.riskAll') },
								{ value: 'low', label: t(data.messages, 'mailGuardian.riskLow') },
								{ value: 'medium', label: t(data.messages, 'mailGuardian.riskMedium') },
								{ value: 'high', label: t(data.messages, 'mailGuardian.riskHigh') },
							]}
						/>
					</div>

					<!-- List -->
					<div class="max-h-[60vh] divide-y divide-border overflow-y-auto">
						{#each filteredReviews as review (review.id)}
							<MailListItem
								{review}
								isSelected={selectedId === review.id}
								isActive={activeReview?.id === review.id}
								isPicked={picked.has(review.id)}
								onTogglePick={(checked) => togglePick(review.id, checked)}
								onSelect={() => (selectedId = review.id)}
								onApprove={(e) => {
									e.stopPropagation();
									approveOne(review.id);
								}}
								onFlag={(e) => {
									e.stopPropagation();
									flagOne(review.id);
								}}
							/>
						{:else}
							<div class="px-3 py-8 text-center text-sm text-muted-foreground">
								{t(data.messages, 'mailGuardian.empty')}
							</div>
						{/each}
					</div>
				</div>
			{/snippet}
		</Card>

		<Card>
			{#snippet children()}
				<MailReadingPane
					review={activeReview}
					onApprove={() => activeReview && approveOne(activeReview.id)}
					onFlag={() => activeReview && flagOne(activeReview.id)}
					approving={activeReview ? approvingIds.has(activeReview.id) : false}
					flagging={activeReview ? flaggingIds.has(activeReview.id) : false}
				/>
			{/snippet}
		</Card>
	</div>

	<MailAccountsPanel messages={data.messages} accounts={data.accounts ?? []} />
</div>
