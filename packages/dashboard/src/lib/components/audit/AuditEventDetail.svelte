<!--
  AuditEventDetail — single audit event detail view.

  Renders every field of the AuditEvent, with prev/next links to walk the
  chain. The chain verification badge is shown alongside the hash chain
  cells (sha256 truncations match the legacy template).

  Sensitive fields (IPs, user agents) are wrapped in a disclosure that
  defaults to hidden to reduce accidental disclosure in a screen-sharing
  scenario — per THREAT_MODEL §6, audit data may include sensitive payloads.

  i18n: every visible label routes through t(messages, 'audit.detail.*').
-->
<script lang="ts">
	import type { AuditEvent, AuditEventId } from '$lib/server/entities';
	import AuditResultBadge from './AuditResultBadge.svelte';
	import { t, type Messages } from '$lib/i18n';

	export type ChainLink = {
		ok: boolean;
		length?: number;
		index?: number;
		reason?: string;
	};

	type Props = {
		event: AuditEvent;
		prevId: AuditEventId | null;
		nextId: AuditEventId | null;
		chainLink: ChainLink | null;
		messages: Messages;
	};

	let { event, prevId, nextId, chainLink, messages }: Props = $props();

	let showSensitive = $state(false);

	function shortHash(hex: string | null): string {
		if (!hex) return '—';
		if (hex.length <= 16) return hex;
		return `${hex.slice(0, 16)}…`;
	}

	const prevLabel = $derived(t(messages, 'audit.detail.prev'));
	const nextLabel = $derived(t(messages, 'audit.detail.next'));
	const prevDisabled = $derived(prevId == null);
	const nextDisabled = $derived(nextId == null);
</script>

<div data-slot="audit-event-detail" class="flex flex-col gap-6">
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
		<label class="flex flex-col gap-1 text-xs text-muted-foreground">
			<span class="font-medium">{t(messages, 'audit.detail.id')}</span>
			<code class="rounded border border-border bg-muted/30 px-2 py-1 font-mono text-xs break-all">
				{event.id}
			</code>
		</label>
		<label class="flex flex-col gap-1 text-xs text-muted-foreground">
			<span class="font-medium">{t(messages, 'audit.detail.createdAt')}</span>
			<code class="rounded border border-border bg-muted/30 px-2 py-1 font-mono text-xs break-all">
				{event.createdAt}
			</code>
		</label>
		<label class="flex flex-col gap-1 text-xs text-muted-foreground">
			<span class="font-medium">{t(messages, 'audit.detail.surface')}</span>
			<code class="rounded border border-border bg-muted/30 px-2 py-1 font-mono text-xs">
				{event.surface}
			</code>
		</label>
		<label class="flex flex-col gap-1 text-xs text-muted-foreground">
			<span class="font-medium">{t(messages, 'audit.detail.action')}</span>
			<code class="rounded border border-border bg-muted/30 px-2 py-1 font-mono text-xs">
				{event.action}
			</code>
		</label>
		<label class="flex flex-col gap-1 text-xs text-muted-foreground">
			<span class="font-medium">{t(messages, 'audit.detail.actorUserId')}</span>
			<code class="rounded border border-border bg-muted/30 px-2 py-1 font-mono text-xs">
				{event.actorUserId ?? '—'}
			</code>
		</label>
		<label class="flex flex-col gap-1 text-xs text-muted-foreground">
			<span class="font-medium">{t(messages, 'audit.detail.actorSessionId')}</span>
			<code class="rounded border border-border bg-muted/30 px-2 py-1 font-mono text-xs break-all">
				{event.actorSessionId ?? '—'}
			</code>
		</label>
		<label class="flex flex-col gap-1 text-xs text-muted-foreground">
			<span class="font-medium">{t(messages, 'audit.detail.target')}</span>
			<code class="rounded border border-border bg-muted/30 px-2 py-1 font-mono text-xs break-all">
				{event.target ?? '—'}
			</code>
		</label>
		<label class="flex flex-col gap-1 text-xs text-muted-foreground">
			<span class="font-medium">{t(messages, 'audit.detail.result')}</span>
			<div>
				<AuditResultBadge {messages} result={event.result} />
				{#if event.errorCode}
					<span class="ml-2 text-xs text-muted-foreground">({event.errorCode})</span>
				{/if}
			</div>
		</label>
		<label class="flex flex-col gap-1 text-xs text-muted-foreground">
			<span class="font-medium">{t(messages, 'audit.detail.requestId')}</span>
			<code class="rounded border border-border bg-muted/30 px-2 py-1 font-mono text-xs break-all">
				{event.requestId}
			</code>
		</label>
	</div>

	<div class="flex flex-col gap-2 rounded-md border border-border bg-muted/20 p-3">
		<div class="flex items-center justify-between">
			<h3 class="text-sm font-semibold">
				{t(messages, 'audit.detail.sensitiveHeading')}
			</h3>
			<button
				type="button"
				class="text-xs text-muted-foreground underline-offset-2 hover:underline"
				onclick={() => (showSensitive = !showSensitive)}
				aria-expanded={showSensitive}
			>
				{showSensitive
					? t(messages, 'audit.detail.hideSensitive')
					: t(messages, 'audit.detail.showSensitive')}
			</button>
		</div>
		{#if showSensitive}
			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2" data-testid="sensitive-fields">
				<label class="flex flex-col gap-1 text-xs text-muted-foreground">
					<span class="font-medium">{t(messages, 'audit.detail.actorIp')}</span>
					<code class="rounded border border-border bg-background px-2 py-1 font-mono text-xs break-all">
						{event.actorIp ?? '—'}
					</code>
				</label>
				<label class="flex flex-col gap-1 text-xs text-muted-foreground">
					<span class="font-medium">{t(messages, 'audit.detail.actorUserAgent')}</span>
					<code class="rounded border border-border bg-background px-2 py-1 font-mono text-xs break-all">
						{event.actorUserAgent ?? '—'}
					</code>
				</label>
			</div>
		{:else}
			<p class="text-xs text-muted-foreground">
				{t(messages, 'audit.detail.sensitiveHint')}
			</p>
		{/if}
	</div>

	<div class="flex flex-col gap-2 rounded-md border border-border bg-muted/20 p-3">
		<h3 class="text-sm font-semibold">{t(messages, 'audit.detail.payloadHeading')}</h3>
		<pre
			data-slot="audit-payload"
			class="max-h-96 overflow-auto rounded border border-border bg-background p-3 text-xs leading-relaxed"
		>{JSON.stringify(event.payload, null, 2)}</pre>
	</div>

	<div class="flex flex-col gap-2 rounded-md border border-border bg-muted/20 p-3">
		<h3 class="text-sm font-semibold">{t(messages, 'audit.detail.chainHeading')}</h3>
		<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
			<label class="flex flex-col gap-1 text-xs text-muted-foreground">
				<span class="font-medium">{t(messages, 'audit.detail.payloadHash')}</span>
				<code class="rounded border border-border bg-background px-2 py-1 font-mono text-xs break-all">
					{event.payloadHash}
				</code>
			</label>
			<label class="flex flex-col gap-1 text-xs text-muted-foreground">
				<span class="font-medium">{t(messages, 'audit.detail.prevHash')}</span>
				<code class="rounded border border-border bg-background px-2 py-1 font-mono text-xs break-all">
					{event.prevHash ?? 'null (genesis row)'}
				</code>
			</label>
		</div>
	{#if chainLink}
		<div
			data-slot="audit-chain-link"
			class="mt-1 text-xs {chainLink.ok ? 'text-success' : 'text-destructive'}"
			data-chain-ok={chainLink.ok}
		>
			{#if chainLink.ok}
				{t(messages, 'audit.detail.chainOk')} ({chainLink.length ?? 0})
			{:else}
				{t(messages, 'audit.detail.chainBroken')} (idx={chainLink.index ?? 0}: {chainLink.reason ?? ''})
			{/if}
		</div>
	{/if}
	</div>

	<nav class="flex items-center justify-between" aria-label={t(messages, 'audit.detail.nav')}>
		{#if prevId}
			<a
				href={`/audit/${prevId}`}
				data-slot="audit-prev"
				class="inline-flex items-center gap-1 text-sm text-primary hover:underline focus-visible:underline focus-visible:outline-none"
			>
				<span aria-hidden="true">←</span>
				<span>{prevLabel}</span>
			</a>
		{:else}
			<span class="text-sm text-muted-foreground">{prevLabel} (—)</span>
		{/if}
		<a
			href="/audit"
			class="text-sm text-muted-foreground hover:underline focus-visible:underline focus-visible:outline-none"
		>
			{t(messages, 'audit.detail.backToList')}
		</a>
		{#if nextId}
			<a
				href={`/audit/${nextId}`}
				data-slot="audit-next"
				class="inline-flex items-center gap-1 text-sm text-primary hover:underline focus-visible:underline focus-visible:outline-none"
			>
				<span>{nextLabel}</span>
				<span aria-hidden="true">→</span>
			</a>
		{:else}
			<span class="text-sm text-muted-foreground">{nextLabel} (—)</span>
		{/if}
	</nav>
</div>
