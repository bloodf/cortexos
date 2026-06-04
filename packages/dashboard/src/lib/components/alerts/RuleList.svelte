<!--
  RuleList — grid of RuleCards with an empty state.

  Used by the /alerts route when the "rules" tab is active, and
  on the rules index. The list is the visual surface; the page
  owns the filter + URL bootstrap.

  i18n: visible strings route through `t(messages, 'alerts.*')`.
-->
<script lang="ts">
	import type { AlertRule } from '@cortexos/contracts';
	import { t, type Messages } from '$lib/i18n';
	import RuleCard from './RuleCard.svelte';
	import EmptyState from '$lib/components/ui/empty-state/EmptyState.svelte';
	import Bell from '$lib/icons/AlertTriangle.svelte';

	type Props = {
		rules: readonly AlertRule[];
		messages: Messages;
		onSelect?: (rule: AlertRule) => void;
		class?: string;
	};

	let { rules, messages, onSelect, class: className }: Props = $props();
</script>

{#if rules.length === 0}
	<EmptyState title={t(messages, 'alerts.rules.empty')} class={className}>
		{#snippet icon()}
			<Bell />
		{/snippet}
	</EmptyState>
{:else}
	<div
		data-slot="rule-list"
		class={['grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3', className].filter(Boolean).join(' ')}
	>
		{#each rules as rule (rule.id)}
			<RuleCard {rule} {messages} {onSelect} />
		{/each}
	</div>
{/if}
