<!--
  ChainVerifyReport — visual report of an audit chain verification run.

  The component is presentational: it takes the result of
  `verifyAuditChain()` (the M1 in-memory chain verifier; M3 swaps to
  the real `verifyAuditLogChain` from the Drizzle repo) and renders
  the result as a banner + key/value list.

  The chain math itself lives in `src/lib/server/audit/`. This
  component is deliberately dumb: no DB, no chain walking, no crypto.

  i18n: every visible string routes through t(messages, 'audit.verify.*').
-->
<script lang="ts">
	import { t, type Messages } from '$lib/i18n';
	import type { AuditVerifyResult } from '$lib/server/audit';

	type Props = {
		result: AuditVerifyResult;
		messages: Messages;
		/** Number of rows in the chain (the verifier's `length` on success). */
		length: number;
	};

	let { result, messages, length }: Props = $props();

	const ok = $derived(result.ok);
	const variant = $derived(ok ? 'success' : 'destructive');
	const bannerLabel = $derived(
		ok ? t(messages, 'audit.verify.bannerOk') : t(messages, 'audit.verify.bannerBroken'),
	);
	// Narrow the union in the template; both fields exist on the broken variant.
	const failureIndex = $derived(result.ok ? null : result.index);
	const failureReason = $derived(result.ok ? null : result.reason);
</script>

<div data-slot="chain-verify-report" data-chain-ok={ok} class="flex flex-col gap-4">
	<div
		class={`flex items-center gap-3 rounded-md border p-4 ${
			ok
				? 'border-success/30 bg-success/10 text-success'
				: 'border-destructive/30 bg-destructive/10 text-destructive'
		}`}
		role="status"
		aria-live="polite"
	>
		<span
			class="inline-flex h-6 w-6 items-center justify-center rounded-full text-sm font-semibold"
			aria-hidden="true"
			data-chain-variant={variant}
		>
			{ok ? '✓' : '✕'}
		</span>
		<div>
			<p class="text-sm font-semibold">{bannerLabel}</p>
			{#if ok}
				<p class="text-xs opacity-80">
					{t(messages, 'audit.verify.lengthHint')} ({length})
				</p>
			{:else}
				<p class="text-xs opacity-80">
					{t(messages, 'audit.verify.firstFailure')} (idx={failureIndex}: {failureReason})
				</p>
			{/if}
		</div>
	</div>

	<dl class="grid grid-cols-1 gap-3 sm:grid-cols-2">
		<div class="flex flex-col gap-1 rounded-md border border-border bg-muted/20 p-3">
			<dt class="text-xs font-medium text-muted-foreground">
				{t(messages, 'audit.verify.length')}
			</dt>
			<dd class="font-mono text-sm">{length}</dd>
		</div>
		<div class="flex flex-col gap-1 rounded-md border border-border bg-muted/20 p-3">
			<dt class="text-xs font-medium text-muted-foreground">
				{t(messages, 'audit.verify.status')}
			</dt>
			<dd class="font-mono text-sm">{ok ? 'OK' : 'BROKEN'}</dd>
		</div>
		{#if !ok}
			<div class="flex flex-col gap-1 rounded-md border border-border bg-muted/20 p-3 sm:col-span-2">
				<dt class="text-xs font-medium text-muted-foreground">
					{t(messages, 'audit.verify.failureIndex')}
				</dt>
				<dd class="font-mono text-sm">{failureIndex}</dd>
			</div>
			<div class="flex flex-col gap-1 rounded-md border border-border bg-muted/20 p-3 sm:col-span-2">
				<dt class="text-xs font-medium text-muted-foreground">
					{t(messages, 'audit.verify.failureReason')}
				</dt>
				<dd class="font-mono text-xs break-all">{failureReason}</dd>
			</div>
		{/if}
	</dl>
</div>
