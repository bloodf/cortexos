"use client";

import * as React from "react";
import useSWR from "swr";
import { Edit2, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface MailAccount {
	slug: string;
	address: string;
	host: string;
	port: number;
	secure: boolean;
	username: string;
	passwordSet: boolean;
	inbox: string;
	trashMailbox?: string;
}

interface AccountForm {
	slug: string;
	address: string;
	host: string;
	port: string;
	secure: boolean;
	username: string;
	password: string;
	inbox: string;
	trashMailbox: string;
}

const emptyForm: AccountForm = {
	slug: "",
	address: "",
	host: "",
	port: "993",
	secure: true,
	username: "",
	password: "",
	inbox: "INBOX",
	trashMailbox: "",
};

const fetcher = (url: string) => fetch(url, { cache: "no-store" }).then((res) => res.json());

function formFromAccount(account: MailAccount): AccountForm {
	return {
		slug: account.slug,
		address: account.address,
		host: account.host,
		port: String(account.port),
		secure: account.secure,
		username: account.username,
		password: "",
		inbox: account.inbox,
		trashMailbox: account.trashMailbox ?? "",
	};
}

export function MailGuardianAccountsPanel() {
	const { data, mutate, isLoading } = useSWR<{ accounts: MailAccount[]; error?: string }>("/api/mail-guardian/accounts", fetcher, { refreshInterval: 10_000 });
	const [form, setForm] = React.useState<AccountForm>(emptyForm);
	const [editingSlug, setEditingSlug] = React.useState<string | null>(null);
	const [running, setRunning] = React.useState<string | null>(null);
	const [message, setMessage] = React.useState<string | null>(null);
	const accounts = data?.accounts ?? [];

	function update<K extends keyof AccountForm>(key: K, value: AccountForm[K]) {
		setForm((current) => ({ ...current, [key]: value }));
	}

	function reset() {
		setEditingSlug(null);
		setForm(emptyForm);
	}

	async function save(event: React.FormEvent) {
		event.preventDefault();
		setRunning("save");
		setMessage(null);
		try {
			const body = {
				...form,
				port: Number(form.port),
				password: form.password || undefined,
			};
			const res = await fetch("/api/mail-guardian/accounts", {
				method: editingSlug ? "PUT" : "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});
			const responseBody = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(responseBody.error ?? `HTTP ${res.status}`);
			setMessage(editingSlug ? "Account updated and Mail Guardian restarted." : "Account added and Mail Guardian restarted.");
			reset();
			await mutate();
		} catch (error) {
			setMessage(error instanceof Error ? error.message : "Failed to save account");
		} finally {
			setRunning(null);
		}
	}

	async function remove(slug: string) {
		setRunning(`delete:${slug}`);
		setMessage(null);
		try {
			const res = await fetch(`/api/mail-guardian/accounts?slug=${encodeURIComponent(slug)}`, { method: "DELETE" });
			const body = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
			setMessage("Account removed and Mail Guardian restarted.");
			await mutate();
		} catch (error) {
			setMessage(error instanceof Error ? error.message : "Failed to remove account");
		} finally {
			setRunning(null);
		}
	}

	return (
		<section className="space-y-4">
			<div className="flex items-center justify-between gap-3">
				<div>
					<h2 className="text-lg font-semibold">Email Accounts</h2>
					<p className="text-sm text-muted-foreground">Manage IMAP accounts watched by Mail Guardian. Changes restart the listener.</p>
				</div>
				<Button type="button" variant="outline" onClick={() => mutate()} disabled={isLoading}>
					<RefreshCw className="size-4" />
					Refresh
				</Button>
			</div>
			{message && <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">{message}</p>}
			<div className="overflow-hidden rounded-lg border border-border">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Account</TableHead>
							<TableHead>Host</TableHead>
							<TableHead>Inbox</TableHead>
							<TableHead>Password</TableHead>
							<TableHead className="text-right">Actions</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{accounts.length === 0 ? (
							<TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">No accounts configured.</TableCell></TableRow>
						) : accounts.map((account) => (
							<TableRow key={account.slug}>
								<TableCell>
									<div className="font-medium">{account.address}</div>
									<div className="font-mono text-xs text-muted-foreground">{account.slug} · {account.username}</div>
								</TableCell>
								<TableCell className="font-mono text-xs">{account.host}:{account.port} {account.secure ? "TLS" : "plain"}</TableCell>
								<TableCell className="font-mono text-xs">{account.inbox}{account.trashMailbox ? ` → ${account.trashMailbox}` : ""}</TableCell>
								<TableCell>{account.passwordSet ? "Stored" : "Missing"}</TableCell>
								<TableCell className="text-right">
									<div className="flex justify-end gap-1">
										<Button type="button" size="icon-sm" variant="outline" title="Edit" onClick={() => { setEditingSlug(account.slug); setForm(formFromAccount(account)); }}>
											<Edit2 className="size-3.5" />
										</Button>
										<Button type="button" size="icon-sm" variant="destructive" title="Remove" disabled={running !== null || accounts.length <= 1} onClick={() => remove(account.slug)}>
											<Trash2 className="size-3.5" />
										</Button>
									</div>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>
			<form onSubmit={save} className="rounded-lg border border-border p-4">
				<div className="mb-3 flex items-center justify-between">
					<h3 className="font-semibold">{editingSlug ? `Edit ${editingSlug}` : "Add Email Account"}</h3>
					{editingSlug && <Button type="button" size="sm" variant="ghost" onClick={reset}><X className="size-4" />Cancel</Button>}
				</div>
				<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
					<Input placeholder="slug" value={form.slug} onChange={(event) => update("slug", event.target.value)} disabled={Boolean(editingSlug)} />
					<Input placeholder="email address" value={form.address} onChange={(event) => update("address", event.target.value)} />
					<Input placeholder="IMAP host" value={form.host} onChange={(event) => update("host", event.target.value)} />
					<Input placeholder="port" value={form.port} onChange={(event) => update("port", event.target.value)} />
					<Input placeholder="username" value={form.username} onChange={(event) => update("username", event.target.value)} />
					<Input placeholder={editingSlug ? "new password optional" : "password"} type="password" value={form.password} onChange={(event) => update("password", event.target.value)} />
					<Input placeholder="inbox" value={form.inbox} onChange={(event) => update("inbox", event.target.value)} />
					<Input placeholder="trash mailbox optional" value={form.trashMailbox} onChange={(event) => update("trashMailbox", event.target.value)} />
				</div>
				<div className="mt-3 flex items-center justify-between gap-3">
					<label className="flex items-center gap-2 text-sm text-muted-foreground">
						<input type="checkbox" checked={form.secure} onChange={(event) => update("secure", event.target.checked)} />
						Use TLS
					</label>
					<Button type="submit" disabled={running !== null}>
						<Plus className="size-4" />
						{running === "save" ? "Saving..." : editingSlug ? "Update Account" : "Add Account"}
					</Button>
				</div>
			</form>
		</section>
	);
}
