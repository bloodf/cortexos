<!--
  AuditLogList — table view of audit events with column headers.

  Built on the native <table> primitive (no DataTable wrapper) because
  the audit log has a fixed, known shape and we want full control over
  cell rendering for truncated hashes / empty cells. Column headers
  route through i18n.

  The list is the most-recent-first ordering. Empty state is provided
  via the EmptyState primitive.

  i18n: column headers and the region aria-label route through
  t(messages, 'audit.list.*').
-->
<script lang="ts">
	import type { AuditEvent } from '$lib/server/entities';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import AuditLogRow from './AuditLogRow.svelte';
	import ScrollText from '$lib/icons/ScrollText.svelte';
	import { t, type Messages } from '$lib/i18n';

	type Props = {
		events: readonly AuditEvent[];
		messages: Messages;
		/** Optional className passthrough. */
		class?: string;
	};

	let { events, messages, class: className }: Props = $props();

	const regionLabel = $derived(t(messages, 'audit.list.regionLabel'));
	const emptyTitle = $derived(t(messages, 'audit.list.emptyTitle'));
	const emptyDescription = $derived(t(messages, 'audit.list.emptyDescription'));
</script>

{#if events.length === 0}
	<EmptyState
		title={emptyTitle}
		description={emptyDescription}
		icon={ScrollText}
	/>
{:else}
	<div
		data-slot="audit-log-list"
		class={`overflow-x-auto rounded-md border border-border ${className ?? ''}`}
		aria-label={regionLabel}
	>
		<table class="w-full text-sm">
			<thead>
				<tr class="border-b border-border bg-muted/50 text-left">
					<th class="px-3 py-2 font-medium">
						{t(messages, 'audit.list.headerWhen')}
					</th>
					<th class="px-3 py-2 font-medium">
						{t(messages, 'audit.list.headerSurface')}
					</th>
					<th class="px-3 py-2 font-medium">
						{t(messages, 'audit.list.headerActor')}
					</th>
					<th class="px-3 py-2 font-medium">
						{t(messages, 'audit.list.headerTarget')}
					</th>
					<th class="px-3 py-2 font-medium">
						{t(messages, 'audit.list.headerResult')}
					</th>
					<th class="px-3 py-2 font-medium">
						{t(messages, 'audit.list.headerHash')}
					</th>
				</tr>
			</thead>
			<tbody>
				{#each events as event (event.id)}
					<AuditLogRow {event} {messages} />
				{/each}
			</tbody>
		</table>
	</div>
{/if}
