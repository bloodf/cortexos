<script lang="ts">
	import Badge from '$lib/components/ui/badge/Badge.svelte';

	type Status = 'pending' | 'approved' | 'flagged';

	interface Props {
		status: Status;
		size?: 'default' | 'sm';
	}

	let { status, size = 'default' }: Props = $props();

	const variantMap: Record<Status, 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline' | 'info'> = {
		pending: 'warning',
		approved: 'success',
		flagged: 'destructive',
	};
</script>

<Badge variant={variantMap[status]} {size}>
	<span class="capitalize">{status}</span>
</Badge>
