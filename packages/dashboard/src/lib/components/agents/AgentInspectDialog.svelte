<!--
  AgentInspectDialog — full file tree + code viewer/editor for an agent profile.
-->
<script lang="ts">
	import type { AgentItem, AgentFile } from './types';
	import Dialog from '$lib/components/ui/dialog/Dialog.svelte';
	import DialogTitle from '$lib/components/ui/dialog/DialogTitle.svelte';
	import CodeBlock from '$lib/components/ui/code-block/CodeBlock.svelte';
	import Badge from '$lib/components/ui/badge/Badge.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Tooltip from '$lib/components/ui/tooltip/Tooltip.svelte';
	import FileText from '$lib/icons/FileText.svelte';
	import FolderTree from '$lib/icons/FolderTree.svelte';
	import X from '$lib/icons/X.svelte';

	type Props = {
		agent: AgentItem | null;
		onClose: () => void;
	};

	let { agent, onClose }: Props = $props();

	let selectedPath = $state<string | null>(null);
	let isEditing = $state(false);
	let editContent = $state('');
	let saving = $state(false);

	const file = $derived(agent?.files.find((f) => f.path === selectedPath) ?? agent?.files[0]);

	function languageFromPath(path: string): string {
		if (path.endsWith('.yaml') || path.endsWith('.yml')) return 'yaml';
		if (path.endsWith('.json')) return 'json';
		if (path.endsWith('.md')) return 'markdown';
		if (path.endsWith('.ts')) return 'typescript';
		if (path.endsWith('.js')) return 'javascript';
		if (path.endsWith('.py')) return 'python';
		if (path.endsWith('.sh')) return 'bash';
		return 'text';
	}

	function selectFile(path: string) {
		selectedPath = path;
		isEditing = false;
	}

	function startEdit() {
		if (!file) return;
		editContent = file.content;
		isEditing = true;
	}

	function cancelEdit() {
		isEditing = false;
		editContent = '';
	}

	async function saveEdit() {
		if (!agent || !file) return;
		saving = true;
		try {
			const res = await fetch(`/api/agents/${agent.slug}/files`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ path: file.path, content: editContent }),
			});
			if (!res.ok) throw new Error(await res.text());
			// Update the file content immutably
			const idx = agent.files.findIndex((f) => f.path === file.path);
			if (idx >= 0) {
				agent.files[idx] = { ...agent.files[idx]!, content: editContent };
			}
			isEditing = false;
		} catch (e) {
			alert('Save failed: ' + (e as Error).message);
		} finally {
			saving = false;
		}
	}

	$effect(() => {
		if (agent) {
			selectedPath = agent.files[0]?.path ?? null;
			isEditing = false;
		}
	});
</script>

<Dialog open={agent !== null} onclose={onClose} class="sm:max-w-[min(90vw,1200px)] w-full max-h-[90vh] min-w-[50vw] min-h-[50vh] flex flex-col">
	{#if agent}
		<div data-slot="dialog-header" class="flex items-center justify-between gap-2 shrink-0 pb-1">
			<DialogTitle class="flex items-center gap-2 min-w-0">
				<FolderTree class="size-4 shrink-0" />
				<span class="truncate">{agent.name}</span>
				<span class="text-xs text-muted-foreground font-mono truncate">{agent.slug}</span>
			</DialogTitle>
			<Tooltip text="Close">
				{#snippet trigger()}
					<button
						type="button"
						class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md hover:bg-muted border"
						onclick={onClose}
						aria-label="Close"
					>
						<X class="size-4" />
					</button>
				{/snippet}
			</Tooltip>
		</div>

		<div class="grid gap-3 md:grid-cols-[220px_1fr] mt-2 min-h-0 flex-1 overflow-hidden">
			<div class="space-y-1 overflow-auto">
				{#each agent.files as f (f.path)}
					{@const af = f as AgentFile}
					<button
						type="button"
						class="w-full text-left rounded px-2 py-1.5 text-xs flex items-center gap-2 hover:bg-muted/50 font-mono truncate"
						class:bg-accent={file?.path === af.path}
						class:text-accent-foreground={file?.path === af.path}
						onclick={() => selectFile(af.path)}
					>
						<FileText class="size-3 text-muted-foreground shrink-0" />
						<span class="truncate">{af.path}</span>
					</button>
				{/each}
				<div class="pt-3 mt-3 border-t space-y-1.5 text-xs">
					<Badge variant="secondary" class="font-mono">{agent.model}</Badge>
					<p class="text-muted-foreground text-[11px]">v{agent.version} · queue {agent.queueDepth}</p>
				</div>
			</div>
			<div class="min-w-0 flex flex-col gap-2 overflow-hidden">
				<div class="flex items-center gap-2 shrink-0">
					{#if isEditing}
						<Button size="sm" onclick={saveEdit} disabled={saving}>
							{saving ? 'Saving…' : 'Save'}
						</Button>
						<Button size="sm" variant="ghost" onclick={cancelEdit}>Cancel</Button>
					{:else}
						<Button size="sm" variant="outline" onclick={startEdit}>Edit</Button>
					{/if}
				</div>
				{#if file}
					{#if isEditing}
						<textarea
							bind:value={editContent}
							class="flex-1 min-h-0 w-full rounded-md border bg-background p-3 text-xs font-mono leading-relaxed tabular-nums resize-none focus:outline-none focus:ring-1 focus:ring-primary"
						/>
					{:else}
						<CodeBlock
							code={file.content}
							language={languageFromPath(file.path)}
							maxHeight={undefined}
							class="flex-1 min-h-0"
						/>
					{/if}
				{:else}
					<div class="text-sm text-muted-foreground">No files to inspect.</div>
				{/if}
			</div>
		</div>
	{/if}
</Dialog>
