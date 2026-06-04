<!--
  ApprovalTokenDisplay — render an opaque approval token (HMAC
  string) for an admin to copy / verify. The token itself is shown
  in monospace; the surrounding card surfaces the expiresAt, iat,
  actionHash, sessionId, and ttlSec claims from the `ApprovalToken`
  record.

  Used by the /approvals/[id] page (when the page has minted a
  fresh token) and by the /api/approvals POST response preview
  in tooling.

  The component never re-computes the action hash; the hash is
  carried in the prop and rendered verbatim. The action binding is
  verified at the API boundary via `actionHashFor(actor, action,
  target)` (PB-1 + SR-020).

  i18n: every visible string routes through
  `t(messages, 'approvals.*')`.
-->
<script lang="ts">
	import { t, type Messages } from '$lib/i18n';

	export interface ApprovalTokenInfo {
		/** The opaque token string (`v1.<payload>.<hmac>`). */
		token: string;
		/** Unix epoch ms. */
		expiresAt: number;
		/** Unix epoch ms. */
		issuedAt: number;
		/** SHA-256 hash of the bound action + payload. */
		actionHash: string;
		/** Session id the token is bound to (SR-020). */
		sessionId: string;
		/** TTL in seconds used to mint the token. */
		ttlSec: number;
	}

	type Props = {
		/** The token to display. */
		token: ApprovalTokenInfo;
		/** Locale messages. */
		messages: Messages;
		/** Optional className passthrough. */
		class?: string;
	};

	let { token, messages, class: className }: Props = $props();

	function fmt(ms: number): string {
		if (!Number.isFinite(ms) || ms <= 0) return '—';
		return new Date(ms).toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
	}

	// i18n strings resolved once per render.
	const ariaToken = $derived(t(messages, 'approvals.detail.fields.run'));
</script>

<div
	class={[
		'flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-4',
		className,
	]
		.filter(Boolean)
		.join(' ')}
	data-slot="approval-token-display"
>
	<div>
		<dt class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
			{ariaToken}
		</dt>
		<dd
			class="mt-1 break-all rounded bg-background p-2 font-mono text-xs"
			data-slot="approval-token-string"
		>
			{token.token}
		</dd>
	</div>

	<dl
		class="grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-2"
		data-slot="approval-token-fields"
	>
		<div>
			<dt class="font-medium text-muted-foreground">issuedAt</dt>
			<dd data-slot="approval-token-issued-at">{fmt(token.issuedAt)}</dd>
		</div>
		<div>
			<dt class="font-medium text-muted-foreground">expiresAt</dt>
			<dd data-slot="approval-token-expires-at">{fmt(token.expiresAt)}</dd>
		</div>
		<div>
			<dt class="font-medium text-muted-foreground">ttlSec</dt>
			<dd data-slot="approval-token-ttl">{token.ttlSec}</dd>
		</div>
		<div>
			<dt class="font-medium text-muted-foreground">sessionId</dt>
			<dd
				class="break-all font-mono"
				data-slot="approval-token-session-id"
			>
				{token.sessionId}
			</dd>
		</div>
		<div class="sm:col-span-2">
			<dt class="font-medium text-muted-foreground">actionHash</dt>
			<dd
				class="break-all font-mono"
				data-slot="approval-token-action-hash"
			>
				{token.actionHash}
			</dd>
		</div>
	</dl>
</div>
