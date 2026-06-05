<!--
  /approvals/history — historical approvals list page.

  Renders a vertical timeline of past approvals (approved/denied/
  timeout) using the `ApprovalHistoryTimeline` component. The
  filters push into the URL (replaceState) so deep links
  round-trip.

  i18n: every visible string routes through `t(data.messages,
  'approvals.*')`.
-->
<script lang="ts">
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import type { PageData } from './$types';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import BookOpenCheck from '$lib/icons/BookOpenCheck.svelte';
	import ApprovalHistoryTimeline from '$lib/components/approvals/ApprovalHistoryTimeline.svelte';
	import { t } from '$lib/i18n';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	const title = $derived(t(data.messages, 'approvals.history.title'));
	const description = $derived(t(data.messages, 'approvals.history.description'));
	const emptyDescription = $derived(t(data.messages, 'approvals.history.empty'));
	const backLabel = $derived(t(data.messages, 'approvals.actions.back'));

	// Local mirror of the URL search params.
	// svelte-ignore state_referenced_locally -- intentional: data is a prop and the initial value only
	let actionQ = $state(data.initialAction);
	// svelte-ignore state_referenced_locally -- intentional: data is a prop and the initial value only
	let userQ = $state(data.initialUser);
	// svelte-ignore state_referenced_locally -- intentional: data is a prop and the initial value only
	let ageQ = $state<'all' | 'lt1h' | 'lt24h' | 'gt24h'>(data.initialAge);

	function applyFilter(next: {
		action: string;
		user: string;
		age: 'all' | 'lt1h' | 'lt24h' | 'gt24h';
	}): void {
		actionQ = next.action;
		userQ = next.user;
		ageQ = next.age;
		const params = new SvelteURLSearchParams(page.url.searchParams);
		if (next.action) params.set('action', next.action);
		else params.delete('action');
		if (next.user) params.set('user', next.user);
		else params.delete('user');
		if (next.age && next.age !== 'all') params.set('age', next.age);
		else params.delete('age');
		const search = params.toString();
		void goto(`${page.url.pathname}${search ? '?' + search : ''}`, {
			replaceState: true,
			keepFocus: true,
			noScroll: true,
		});
	}

	const ageOptions: ReadonlyArray<{ key: 'all' | 'lt1h' | 'lt24h' | 'gt24h'; label: string }> = $derived([
		{ key: 'all', label: t(data.messages, 'approvals.list.filters.all') },
		{ key: 'lt1h', label: t(data.messages, 'approvals.list.filters.lessThan1h') },
		{ key: 'lt24h', label: t(data.messages, 'approvals.list.filters.lessThan24h') },
		{ key: 'gt24h', label: t(data.messages, 'approvals.list.filters.olderThan24h') },
	]);
</script>

<svelte:head>
	<title>{title} · CortexOS</title>
</svelte:head>

<div class="flex flex-col gap-6">
	<PageHeader
		{title}
		{description}
		icon={BookOpenCheck}
	/>

	<div class="flex flex-wrap items-center justify-between gap-2">
		<div
			class="flex flex-wrap items-center gap-2"
			data-slot="approval-history-filters"
			role="toolbar"
			aria-label={t(data.messages, 'approvals.list.filters.action')}
		>
			<input
				type="text"
				class="rounded-md border border-input bg-background px-3 py-1 text-sm"
				placeholder={t(data.messages, 'approvals.list.filters.action')}
				aria-label={t(data.messages, 'approvals.list.filters.action')}
				value={actionQ}
				data-slot="approval-filter-action"
				oninput={(e) =>
					applyFilter({
						action: (e.currentTarget as HTMLInputElement).value,
						user: userQ,
						age: ageQ,
					})}
			/>
			<input
				type="text"
				class="rounded-md border border-input bg-background px-3 py-1 text-sm"
				placeholder={t(data.messages, 'approvals.list.filters.user')}
				aria-label={t(data.messages, 'approvals.list.filters.user')}
				value={userQ}
				data-slot="approval-filter-user"
				oninput={(e) =>
					applyFilter({
						action: actionQ,
						user: (e.currentTarget as HTMLInputElement).value,
						age: ageQ,
					})}
			/>
			{#each ageOptions as opt (opt.key)}
				<button
					type="button"
					class={[
						'rounded-full border px-3 py-1 text-xs transition-colors',
						ageQ === opt.key
							? 'border-primary bg-primary text-primary-foreground'
							: 'border-border bg-background text-foreground hover:bg-muted',
					].join(' ')}
					aria-pressed={ageQ === opt.key}
					data-slot="approval-filter-age"
					data-age={opt.key}
					onclick={() => applyFilter({ action: actionQ, user: userQ, age: opt.key })}
				>
					{opt.label}
				</button>
			{/each}
		</div>
		<a
			class="text-sm text-muted-foreground underline-offset-4 hover:underline"
			href="/approvals"
			data-slot="approval-history-back"
		>
			← {backLabel}
		</a>
	</div>

	{#if data.approvals.length === 0}
		<EmptyState
			{title}
			description={emptyDescription}
			icon={BookOpenCheck}
		/>
	{:else}
		<ApprovalHistoryTimeline
			messages={data.messages}
			approvals={data.approvals}
		/>
	{/if}
</div>
