<!--
  AuditLogRow — single row in the audit log table.

  The row is interactive: clicking anywhere on the row navigates to the
  detail page (`/audit/{id}`). We use a wrapping <a> for the navigation so
  the URL is meaningful in the browser's status bar and the row remains
  accessible via keyboard (Tab + Enter).

  The chain-hash cell is truncated to 12 chars (matches the legacy
  template's UX). The full hash is in the `title` attribute for hover.

  i18n: column-like cells route through t(messages, 'audit.list.*').
-->
<script lang="ts">
	import type { AuditEvent } from '$lib/server/entities';
	import AuditResultBadge from './AuditResultBadge.svelte';
	import { t, type Messages } from '$lib/i18n';

	type Props = {
		event: AuditEvent;
		messages: Messages;
	};

	let { event, messages }: Props = $props();

	/** Truncate a sha256 hex to its first 12 chars + ellipsis. */
	function shortHash(hex: string | null): string {
		if (!hex) return '—';
		if (hex.length <= 12) return hex;
		return `${hex.slice(0, 12)}…`;
	}

	/** Format an ISO timestamp as a short, locale-agnostic string. */
	function formatTs(iso: string): string {
		try {
			const d = new Date(iso);
			return d.toISOString().replace('T', ' ').replace('Z', 'Z');
		} catch {
			return iso;
		}
	}
</script>

<tr
	data-slot="audit-log-row"
	data-id={event.id}
	class="border-b border-border/60 hover:bg-muted/40"
>
	<td class="px-3 py-2 font-mono text-xs text-muted-foreground whitespace-nowrap">
		{formatTs(event.createdAt)}
	</td>
	<td class="px-3 py-2 text-xs">
		<a
			href={`/audit/${event.id}`}
			class="text-foreground hover:underline focus-visible:underline focus-visible:outline-none"
			aria-label={t(messages, 'audit.list.openDetail') + `: ${event.id}`}
			data-slot="audit-log-row-link"
		>
			<code class="text-xs">{event.surface}/{event.action}</code>
		</a>
	</td>
	<td class="px-3 py-2 text-xs">
		<code class="text-xs">{event.actorUserId ?? '—'}</code>
	</td>
	<td class="px-3 py-2 text-xs text-muted-foreground">
		{event.target ?? '—'}
	</td>
	<td class="px-3 py-2">
		<AuditResultBadge {messages} result={event.result} size="sm" />
	</td>
	<td class="px-3 py-2 font-mono text-xs text-muted-foreground" title={event.payloadHash}>
		{shortHash(event.payloadHash)}
	</td>
</tr>
