<!--
  MailAccountsPanel — admin management for monitored IMAP accounts.

  Lists mail_guardian_accounts and lets an admin add, edit, enable/disable,
  and delete them via /api/mail-guardian/accounts. Passwords are write-only:
  the server returns `hasPassword` but never the value, and an empty password
  field on edit keeps the stored one.
-->
<script lang="ts">
	import { t, type Messages } from '$lib/i18n';
	import Card from '$lib/components/ui/Card.svelte';
	import Button from '$lib/components/ui/button/Button.svelte';
	import Input from '$lib/components/ui/input/Input.svelte';
	import Checkbox from '$lib/components/ui/checkbox/Checkbox.svelte';

	// Mirror of the server's MailGuardianAccountSafe (password redacted). Defined
	// locally so this client component never imports from $lib/server.
	export interface MailGuardianAccountSafe {
		id: number;
		slug: string;
		address: string;
		host: string;
		port: number;
		secure: boolean;
		username: string;
		inbox: string;
		trashMailbox: string | null;
		reviewMailbox: string;
		enabled: boolean;
		createdAt: Date | string;
		updatedAt: Date | string;
		hasPassword: boolean;
	}

	interface Props {
		messages: Messages;
		accounts: MailGuardianAccountSafe[];
	}

	let { messages, accounts }: Props = $props();

	let rows = $state<MailGuardianAccountSafe[]>([]);
	$effect(() => {
		rows = accounts ?? [];
	});

	interface FormState {
		slug: string;
		address: string;
		host: string;
		port: number;
		secure: boolean;
		username: string;
		password: string;
		inbox: string;
		trashMailbox: string;
		reviewMailbox: string;
		enabled: boolean;
	}

	function emptyForm(): FormState {
		return {
			slug: '',
			address: '',
			host: '',
			port: 993,
			secure: true,
			username: '',
			password: '',
			inbox: 'INBOX',
			trashMailbox: '',
			reviewMailbox: 'INBOX.Cortex Mail Guardian Review',
			enabled: true,
		};
	}

	let editingSlug = $state<string | null>(null); // null = not open; '' = creating new
	let form = $state<FormState>(emptyForm());
	let busy = $state(false);
	let error = $state('');

	function openCreate() {
		form = emptyForm();
		editingSlug = '';
		error = '';
	}

	function openEdit(acc: MailGuardianAccountSafe) {
		form = {
			slug: acc.slug,
			address: acc.address,
			host: acc.host,
			port: acc.port,
			secure: acc.secure,
			username: acc.username,
			password: '',
			inbox: acc.inbox,
			trashMailbox: acc.trashMailbox ?? '',
			reviewMailbox: acc.reviewMailbox,
			enabled: acc.enabled,
		};
		editingSlug = acc.slug;
		error = '';
	}

	function closeForm() {
		editingSlug = null;
		error = '';
	}

	function payload() {
		return {
			...form,
			port: Number(form.port),
			trashMailbox: form.trashMailbox.trim() === '' ? null : form.trashMailbox.trim(),
			password: form.password === '' ? undefined : form.password,
		};
	}

	async function save() {
		if (busy) return;
		busy = true;
		error = '';
		try {
			const isCreate = editingSlug === '';
			const body = payload();
			if (isCreate && !body.password) {
				error = 'Password is required for a new account.';
				return;
			}
			const url = isCreate
				? '/api/mail-guardian/accounts'
				: `/api/mail-guardian/accounts/${encodeURIComponent(editingSlug!)}`;
			const res = await fetch(url, {
				method: isCreate ? 'POST' : 'PUT',
				credentials: 'include',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(body),
			});
			if (!res.ok) {
				error = (await res.text()) || 'Request failed';
				return;
			}
			const data = (await res.json()) as { account: MailGuardianAccountSafe };
			if (isCreate) {
				rows = [...rows, data.account].sort((a, b) => a.slug.localeCompare(b.slug));
			} else {
				rows = rows.map((r) => (r.slug === data.account.slug ? data.account : r));
			}
			closeForm();
		} finally {
			busy = false;
		}
	}

	async function toggleEnabled(acc: MailGuardianAccountSafe) {
		if (busy) return;
		busy = true;
		try {
			const res = await fetch(`/api/mail-guardian/accounts/${encodeURIComponent(acc.slug)}`, {
				method: 'PATCH',
				credentials: 'include',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ enabled: !acc.enabled }),
			});
			if (!res.ok) return;
			const data = (await res.json()) as { account: MailGuardianAccountSafe };
			rows = rows.map((r) => (r.slug === data.account.slug ? data.account : r));
		} finally {
			busy = false;
		}
	}

	async function remove(acc: MailGuardianAccountSafe) {
		const confirmMsg = t(messages, 'mailGuardian.accountDeleteConfirm').replace('{slug}', acc.slug);
		if (!confirm(confirmMsg)) return;
		if (busy) return;
		busy = true;
		try {
			const res = await fetch(`/api/mail-guardian/accounts/${encodeURIComponent(acc.slug)}`, {
				method: 'DELETE',
				credentials: 'include',
			});
			if (!res.ok) return;
			rows = rows.filter((r) => r.slug !== acc.slug);
		} finally {
			busy = false;
		}
	}
</script>

<Card>
	{#snippet children()}
		<div class="flex flex-col gap-4">
			<div class="flex items-center justify-between">
				<div>
					<h2 class="text-sm font-semibold">{t(messages, 'mailGuardian.accountsTitle')}</h2>
					<p class="text-xs text-muted-foreground">{t(messages, 'mailGuardian.accountsDescription')}</p>
				</div>
				{#if editingSlug === null}
					<Button size="sm" variant="default" onclick={openCreate}>
						{t(messages, 'mailGuardian.accountAdd')}
					</Button>
				{/if}
			</div>

			{#if editingSlug !== null}
				<div class="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-2">
					<label class="flex flex-col gap-1 text-xs">
						<span class="text-muted-foreground">{t(messages, 'mailGuardian.accountSlug')}</span>
						<Input bind:value={form.slug} disabled={editingSlug !== ''} placeholder="my-inbox" />
					</label>
					<label class="flex flex-col gap-1 text-xs">
						<span class="text-muted-foreground">{t(messages, 'mailGuardian.accountAddress')}</span>
						<Input type="email" bind:value={form.address} placeholder="me@example.com" />
					</label>
					<label class="flex flex-col gap-1 text-xs">
						<span class="text-muted-foreground">{t(messages, 'mailGuardian.accountHost')}</span>
						<Input bind:value={form.host} placeholder="mail.example.com" />
					</label>
					<label class="flex flex-col gap-1 text-xs">
						<span class="text-muted-foreground">{t(messages, 'mailGuardian.accountPort')}</span>
						<Input type="number" bind:value={form.port} />
					</label>
					<label class="flex flex-col gap-1 text-xs">
						<span class="text-muted-foreground">{t(messages, 'mailGuardian.accountUsername')}</span>
						<Input bind:value={form.username} placeholder="me@example.com" />
					</label>
					<label class="flex flex-col gap-1 text-xs">
						<span class="text-muted-foreground">{t(messages, 'mailGuardian.accountPassword')}</span>
						<Input type="password" bind:value={form.password} />
						{#if editingSlug !== ''}
							<span class="text-[10px] text-muted-foreground">{t(messages, 'mailGuardian.accountPasswordKeep')}</span>
						{/if}
					</label>
					<label class="flex flex-col gap-1 text-xs">
						<span class="text-muted-foreground">{t(messages, 'mailGuardian.accountInbox')}</span>
						<Input bind:value={form.inbox} />
					</label>
					<label class="flex flex-col gap-1 text-xs">
						<span class="text-muted-foreground">{t(messages, 'mailGuardian.accountReviewMailbox')}</span>
						<Input bind:value={form.reviewMailbox} />
					</label>
					<label class="flex flex-col gap-1 text-xs">
						<span class="text-muted-foreground">{t(messages, 'mailGuardian.accountTrashMailbox')}</span>
						<Input bind:value={form.trashMailbox} />
					</label>
					<div class="flex items-end gap-4">
						<label class="flex items-center gap-2 text-xs">
							<Checkbox bind:checked={form.secure} />
							{t(messages, 'mailGuardian.accountSecure')}
						</label>
						<label class="flex items-center gap-2 text-xs">
							<Checkbox bind:checked={form.enabled} />
							{t(messages, 'mailGuardian.accountEnabled')}
						</label>
					</div>
					{#if error}
						<p class="text-xs text-destructive sm:col-span-2">{error}</p>
					{/if}
					<div class="flex items-center gap-2 sm:col-span-2">
						<Button size="sm" variant="default" loading={busy} disabled={busy} onclick={save}>
							{t(messages, 'mailGuardian.accountSave')}
						</Button>
						<Button size="sm" variant="ghost" disabled={busy} onclick={closeForm}>
							{t(messages, 'mailGuardian.accountCancel')}
						</Button>
					</div>
				</div>
			{/if}

			<div class="divide-y divide-border rounded-md border border-border">
				{#each rows as acc (acc.slug)}
					<div class="flex items-center gap-3 px-3 py-2 text-sm">
						<div class="min-w-0 flex-1">
							<div class="flex items-center gap-2">
								<span class="font-medium">{acc.slug}</span>
								<span
									class="rounded px-1.5 py-0.5 text-[10px] {acc.enabled ? 'bg-emerald-500/15 text-emerald-600' : 'bg-muted text-muted-foreground'}"
								>
									{acc.enabled ? t(messages, 'mailGuardian.accountEnabled') : t(messages, 'mailGuardian.accountDisabled')}
								</span>
							</div>
							<div class="truncate text-xs text-muted-foreground">{acc.address} · {acc.host}:{acc.port}</div>
						</div>
						<div class="flex items-center gap-1">
							<Button size="sm" variant="ghost" disabled={busy} onclick={() => toggleEnabled(acc)}>
								{acc.enabled ? t(messages, 'mailGuardian.accountDisable') : t(messages, 'mailGuardian.accountEnable')}
							</Button>
							<Button size="sm" variant="ghost" disabled={busy} onclick={() => openEdit(acc)}>
								{t(messages, 'mailGuardian.accountEdit')}
							</Button>
							<Button size="sm" variant="destructive" disabled={busy} onclick={() => remove(acc)}>
								{t(messages, 'mailGuardian.accountDelete')}
							</Button>
						</div>
					</div>
				{:else}
					<div class="px-3 py-6 text-center text-sm text-muted-foreground">
						{t(messages, 'mailGuardian.accountsEmpty')}
					</div>
				{/each}
			</div>
		</div>
	{/snippet}
</Card>
