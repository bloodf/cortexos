<!--
  /approvals/[id] — single-approval detail page.

  Renders the `ApprovalDetail` component with the loaded data and
  an `ApprovalActionBar` (grant / revoke) for the page-server's
  form actions. The buttons submit via standard HTML forms so the
  page is fully usable without JavaScript.

  i18n: every visible string routes through `t(data.messages,
  'approvals.*')`.
-->
<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import ApprovalDetail from '$lib/components/approvals/ApprovalDetail.svelte';
	import ApprovalActionBar from '$lib/components/approvals/ApprovalActionBar.svelte';
	import { t } from '$lib/i18n';

	interface Props {
		data: PageData;
		form: ActionData;
	}

	let { data, form }: Props = $props();

	const title = $derived(t(data.messages, 'approvals.detail.title'));
	const backLabel = $derived(t(data.messages, 'approvals.actions.back'));
	const viewHistoryLabel = $derived(t(data.messages, 'approvals.actions.viewHistory'));
</script>

<svelte:head>
	<title>{title} · CortexOS</title>
</svelte:head>

<div class="flex flex-col gap-6">
	<div class="flex flex-wrap items-center justify-between gap-2">
		<h1 class="text-2xl font-semibold tracking-tight" data-slot="approval-detail-heading">
			{title}
		</h1>
		<div class="flex items-center gap-3 text-sm">
			<a
				class="text-muted-foreground underline-offset-4 hover:underline"
				href="/approvals"
				data-slot="approval-detail-back"
			>
				← {backLabel}
			</a>
			<a
				class="text-muted-foreground underline-offset-4 hover:underline"
				href="/approvals/history"
				data-slot="approval-detail-view-history"
			>
				{viewHistoryLabel}
			</a>
		</div>
	</div>

	{#if form && typeof form === 'object' && 'error' in form && (form as { error?: string }).error}
		<div
			role="alert"
			class="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive"
			data-slot="approval-detail-form-error"
		>
			{(form as { error?: string }).error}
		</div>
	{/if}

	<ApprovalDetail messages={data.messages} approval={data.approval}>
		{#snippet actions()}
			<ApprovalActionBar
				messages={data.messages}
				approval={data.approval}
				apiBase="/api/approvals"
			/>
		{/snippet}
	</ApprovalDetail>
</div>
