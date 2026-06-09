<script lang="ts">
	import type { ProcessInfo } from '$lib/types/dashboard';
	import Progress from '$lib/components/ui/progress/Progress.svelte';
	import ChevronDown from '$lib/icons/ChevronDown.svelte';

	interface Props {
		group: { user: string; items: ProcessInfo[]; cpu: number; mem: number };
	}

	let { group }: Props = $props();
	let open = $state(true);
</script>

<div>
	<button
		type="button"
		class="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/40 text-sm"
		aria-expanded={open}
		onclick={() => (open = !open)}
	>
		{#if open}
			<ChevronDown class="size-3.5 text-muted-foreground" />
		{:else}
			<span class="size-3.5 inline-block text-muted-foreground">›</span>
		{/if}
		<span class="font-medium">{group.user}</span>
		<span class="text-xs text-muted-foreground">{group.items.length} proc{group.items.length === 1 ? '' : 's'}</span>
		<div class="flex-1"></div>
		<span class="text-xs text-muted-foreground tabular-nums">CPU {group.cpu.toFixed(1)}% · MEM {group.mem.toFixed(1)}%</span>
	</button>
	{#if open}
		<ul class="bg-background/40">
			{#each group.items as p (p.pid)}
				<li class="grid grid-cols-[80px_1fr_120px_120px] items-center gap-3 px-3 py-1.5 pl-9 text-xs hover:bg-muted/30 border-t">
					<span class="font-mono tabular-nums text-muted-foreground">{p.pid}</span>
					<span class="font-mono truncate" title={p.command}>{p.command}</span>
					<div class="flex items-center gap-2">
						<Progress value={p.cpu} class="h-1 w-16" />
						<span class="tabular-nums">{p.cpu.toFixed(1)}</span>
					</div>
					<div class="flex items-center gap-2">
						<Progress value={p.mem} class="h-1 w-16" />
						<span class="tabular-nums">{p.mem.toFixed(1)}</span>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</div>
