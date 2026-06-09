<script lang="ts">
	import type { PageData } from './$types';
	import { t } from '$lib/i18n';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Button from '$lib/components/ui/button/Button.svelte';
	import Input from '$lib/components/ui/input/Input.svelte';
	import FolderArchive from '$lib/icons/FolderArchive.svelte';
	import FileCode from '$lib/icons/FileCode.svelte';
	import Eye from '$lib/icons/Eye.svelte';
	import EyeOff from '$lib/icons/EyeOff.svelte';
	import Copy from '$lib/icons/Copy.svelte';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	let selectedPath = $state<string | null>(null);
	let entries = $state<Array<{ key: string; value: string; masked: string }>>([]);
	let loading = $state(false);
	let error = $state('');
	let reveal = $state<Record<string, boolean>>({});
	let copiedKey = $state<string | null>(null);

	// Secret-reveal window state. Cleartext values only arrive from the
	// server while `secretsUnlocked` is true (a PAM-verified 10-min grant).
	let secretsUnlocked = $state(false);
	let revealExpiresAt = $state<number | null>(null);
	let showUnlock = $state(false);
	let unlockPassword = $state('');
	let unlocking = $state(false);
	let unlockError = $state('');

	async function loadFile(path: string) {
		selectedPath = path;
		loading = true;
		error = '';
		try {
			const res = await fetch(`/api/env-browser?path=${encodeURIComponent(path)}`, { credentials: 'include' });
			if (!res.ok) throw new Error(await res.text());
			const json = await res.json();
			entries = json.entries ?? [];
			secretsUnlocked = json.revealed === true;
			revealExpiresAt = json.revealExpiresAt ?? null;
			reveal = {};
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load';
			entries = [];
		} finally {
			loading = false;
		}
	}

	async function unlockSecrets(e: SubmitEvent) {
		e.preventDefault();
		if (!unlockPassword) return;
		unlocking = true;
		unlockError = '';
		try {
			const res = await fetch('/api/env-browser/unlock', {
				method: 'POST',
				credentials: 'include',
				headers: {
					'Content-Type': 'application/json',
					'X-CSRF-Token': data.session?.csrfToken ?? '',
				},
				body: JSON.stringify({ password: unlockPassword }),
			});
			if (!res.ok) {
				const body = await res.json().catch(() => null);
				throw new Error(body?.error?.message ?? 'Password verification failed');
			}
			const json = await res.json();
			revealExpiresAt = json.expiresAt ?? null;
			secretsUnlocked = true;
			showUnlock = false;
			unlockPassword = '';
			// Re-fetch the current file so cleartext values arrive.
			if (selectedPath) await loadFile(selectedPath);
		} catch (err) {
			unlockError = err instanceof Error ? err.message : 'Unlock failed';
		} finally {
			unlocking = false;
		}
	}

	function toggleReveal(key: string) {
		reveal = { ...reveal, [key]: !reveal[key] };
	}

	async function copyValue(key: string, value: string) {
		try {
			await navigator.clipboard.writeText(value);
			copiedKey = key;
			setTimeout(() => {
				if (copiedKey === key) copiedKey = null;
			}, 1200);
		} catch {
			// ignore
		}
	}

	const selectedFile = $derived(data.files.find((f) => f.path === selectedPath) ?? null);
	const groupedEntries = $derived.by(() => {
		const map = new Map<string, typeof entries>();
		for (const entry of entries) {
			const group = entry.key.split('_')[0] ?? 'General';
			const list = map.get(group) ?? [];
			list.push(entry);
			map.set(group, list);
		}
		return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
	});
</script>

<svelte:head>
	<title>{t(data.messages, 'envBrowser.title')} · Admin · CortexOS</title>
</svelte:head>

<div class="flex flex-col gap-6">
	<PageHeader
		title={t(data.messages, 'envBrowser.title')}
		description={t(data.messages, 'envBrowser.description')}
		icon={FolderArchive}
	/>

	{#if data.files.length === 0}
		<EmptyState
			title={t(data.messages, 'envBrowser.emptyTitle')}
			description={t(data.messages, 'envBrowser.emptyDescription')}
			icon={FolderArchive}
		/>
	{:else}
		<div class="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
			<Card class="h-fit p-2">
				{#snippet children()}
					<div class="px-2 pb-2 text-[10px] uppercase tracking-wide text-muted-foreground">
						{t(data.messages, 'envBrowser.filesHeading')}
					</div>
					<div class="flex flex-col gap-1">
						{#each data.files as file}
							<button
								type="button"
								onclick={() => loadFile(file.path)}
								class={[
									'w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors flex items-center gap-2',
									selectedPath === file.path
										? 'bg-accent text-accent-foreground'
										: 'hover:bg-muted/50',
								]}
							>
								<FileCode class="size-3.5 shrink-0" />
								<span class="truncate font-mono text-xs">{file.name}</span>
							</button>
						{/each}
					</div>
				{/snippet}
			</Card>

			<Card>
				{#snippet children()}
					{#if loading}
						<div class="text-sm text-muted-foreground">{t(data.messages, 'envBrowser.loading')}</div>
					{:else if error}
						<div class="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
							{error}
						</div>
					{:else if selectedFile}
						<div class="mb-3 flex items-center justify-between">
							<code class="text-xs text-muted-foreground">{selectedFile.path}</code>
							<span class="text-xs text-muted-foreground">
								{t(data.messages, 'envBrowser.keyCount').replace('{count}', String(entries.length))}
							</span>
						</div>

						<!-- Secret-reveal gate: cleartext requires a PAM-verified 10-min window. -->
						<div class="mb-3 rounded-md border border-border bg-muted/30 p-2">
							{#if secretsUnlocked}
								<div class="flex items-center gap-2 text-xs text-success">
									<Eye class="size-3.5" />
									<span>Secrets unlocked — values are shown in cleartext.</span>
								</div>
							{:else if showUnlock}
								<form class="flex items-center gap-2" onsubmit={unlockSecrets}>
									<EyeOff class="size-3.5 shrink-0 text-muted-foreground" />
									<Input
										type="password"
										bind:value={unlockPassword}
										placeholder="Your login (PAM) password"
										class="h-8 flex-1 text-xs"
									/>
									<Button type="submit" size="sm" class="h-8" disabled={unlocking || !unlockPassword}>
										{unlocking ? 'Verifying…' : 'Unlock 10 min'}
									</Button>
									<Button
										type="button"
										size="sm"
										variant="ghost"
										class="h-8"
										onclick={() => {
											showUnlock = false;
											unlockPassword = '';
											unlockError = '';
										}}
									>
										Cancel
									</Button>
								</form>
								{#if unlockError}
									<div class="mt-1 text-xs text-red-600 dark:text-red-400">{unlockError}</div>
								{/if}
							{:else}
								<div class="flex items-center justify-between gap-2">
									<div class="flex items-center gap-2 text-xs text-muted-foreground">
										<EyeOff class="size-3.5" />
										<span>Secrets are masked. Re-enter your password to reveal them.</span>
									</div>
									<Button type="button" size="sm" variant="outline" class="h-8" onclick={() => (showUnlock = true)}>
										Unlock secrets
									</Button>
								</div>
							{/if}
						</div>

						{#if entries.length === 0}
							<div class="text-sm text-muted-foreground">{t(data.messages, 'envBrowser.noEntries')}</div>
						{:else}
							<div class="space-y-4">
								{#each groupedEntries as [group, groupEntries]}
									<div>
										<h4 class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
											{group}
										</h4>
										<div class="space-y-2">
											{#each groupEntries as entry (entry.key)}
												<div class="grid grid-cols-[180px_1fr_auto] items-center gap-2">
													<code class="truncate text-xs font-semibold">{entry.key}</code>
													<Input
														value={reveal[entry.key] ? entry.value : entry.masked}
														readonly
														type={reveal[entry.key] ? 'text' : 'password'}
														class="h-8 font-mono text-xs"
													/>
													<div class="flex gap-1">
														<Button
															size="icon"
															variant="ghost"
															class="size-8"
															onclick={() => toggleReveal(entry.key)}
															aria-label={reveal[entry.key]
																? t(data.messages, 'envBrowser.hide')
																: t(data.messages, 'envBrowser.reveal')}
														>
															{#if reveal[entry.key]}
																<EyeOff class="size-3.5" />
															{:else}
																<Eye class="size-3.5" />
															{/if}
														</Button>
														<Button
															size="icon"
															variant="ghost"
															class="size-8"
															onclick={() => copyValue(entry.key, entry.value)}
															aria-label={t(data.messages, 'envBrowser.copy')}
														>
															<Copy class={'size-3.5' + (copiedKey === entry.key ? ' text-success' : '')} />
														</Button>
													</div>
												</div>
											{/each}
										</div>
									</div>
								{/each}
							</div>
						{/if}
					{:else}
						<div class="text-sm text-muted-foreground">
							{t(data.messages, 'envBrowser.selectHint')}
						</div>
					{/if}
				{/snippet}
			</Card>
		</div>
	{/if}
</div>
