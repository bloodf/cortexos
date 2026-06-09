<!--
  KeyValueList — DL-style two-column grid for metadata.

  Usage:
    <KeyValueList items={[
      { key: 'Name', value: 'example' },
      { key: 'Status', value: 'running' },
    ]} />
-->
<script lang="ts">
	type Item = {
		key: string;
		value: string;
	};

	type Props = {
		items: Item[];
		class?: string;
	};

	let { items, class: className }: Props = $props();
</script>

<dl class="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm {className ?? ''}">
	{#each items as it (it.key)}
		<dt class="text-muted-foreground whitespace-nowrap">{it.key}</dt>
		<dd class="font-mono text-xs break-all">{it.value}</dd>
	{/each}
</dl>
