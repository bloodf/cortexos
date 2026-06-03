<!--
  OperationalAlertList — grid of OperationalAlertCards with empty state.

  Used by the /alerts/operational route. The list is the
  presentation surface; the page owns the filter state and the
  URL bootstrap.

  i18n: every visible string routes through `t(messages, 'alerts.*')`.
-->
<script lang="ts">
	import type { OperationalAlert } from '@cortexos/contracts';
	import { t, type Messages } from '$lib/i18n';
	import OperationalAlertCard from './OperationalAlertCard.svelte';
	import EmptyState from '$lib/components/ui/empty-state/EmptyState.svelte';
	import Bell from '$lib/icons/AlertTriangle.svelte';

	type Props = {
		alerts: readonly OperationalAlert[];
		messages: Messages;
		onSelect?: (alert: OperationalAlert) => void;
		class?: string;
	};

	let { alerts, messages, onSelect, class: className }: Props = $props();
</script>

{#if alerts.length === 0}
	<EmptyState title={t(messages, 'alerts.operational.empty')} class={className}>
		{#snippet icon()}
			<Bell />
		{/snippet}
	</EmptyState>
{:else}
	<div
		data-slot="operational-alert-list"
		class={['grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3', className]
			.filter(Boolean)
			.join(' ')}
	>
		{#each alerts as alert (alert.id)}
			<OperationalAlertCard {alert} {messages} {onSelect} />
		{/each}
	</div>
{/if}
