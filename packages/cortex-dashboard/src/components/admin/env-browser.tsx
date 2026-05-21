"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Eye, Pencil, Save } from "lucide-react";
import useSWR from "swr";
import { DataTable } from "@/components/ui/data-table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";

interface EnvLine { line: number; type: "kv" | "comment" | "blank"; key?: string; value?: string; masked?: string }
interface EnvFileRow { path: string; group: string; file: string; exists: boolean }
const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function EnvBrowser() {
	const { data } = useSWR<{ files: EnvFileRow[] }>("/api/env-browser/list", fetcher);
	const rows = data?.files ?? [];
	const [activePath, setActivePath] = React.useState<string | null>(null);
	const [missingPath, setMissingPath] = React.useState<string | null>(null);
	const [lines, setLines] = React.useState<EnvLine[]>([]);
	const [edits, setEdits] = React.useState<Record<string, string>>({});
	const [revealed, setRevealed] = React.useState<Record<string, string>>({});
	const [postHash, setPostHash] = React.useState<string | null>(null);
	const [error, setError] = React.useState<string | null>(null);
	const [globalFilter, setGlobalFilter] = React.useState("");
	const [dialogOpen, setDialogOpen] = React.useState(false);
	const [mode, setMode] = React.useState<"view" | "edit">("view");

	const loadPath = React.useCallback(async (p: string, exists: boolean, nextMode: "view" | "edit") => {
		setMode(nextMode); setDialogOpen(true);
		setActivePath(p); setMissingPath(exists ? null : p); setLines([]); setEdits({}); setRevealed({}); setPostHash(null); setError(null);
		if (!exists) return;
		try { const res = await fetch(`/api/env-browser?path=${encodeURIComponent(p)}`); if (!res.ok) { const body = (await res.json()) as { error?: string; code?: string }; if (res.status === 404 || body.code === "ENOTFOUND") { setMissingPath(p); return; } setError(body.error ?? `HTTP ${res.status}`); return; } const data = (await res.json()) as { lines: EnvLine[] }; setLines(data.lines); }
		catch (err) { setError(err instanceof Error ? err.message : "Failed to load"); }
	}, []);

	async function reveal(key: string) {
		if (!activePath) return;
		const token = window.prompt(`Reveal "${key}"? Paste confirmation token. This action is audit-logged.`);
		if (!token) return;
		const res = await fetch(`/api/env-browser?path=${encodeURIComponent(activePath)}&reveal=true&keys=${encodeURIComponent(key)}`, { headers: { "X-Cortex-Confirmation-Token": token } });
		if (!res.ok) { const body = (await res.json()) as { error?: string }; setError(body.error ?? "Reveal failed"); return; }
		const data = (await res.json()) as { keys: Record<string, string | null> };
		setRevealed((prev) => ({ ...prev, [key]: data.keys[key] ?? "" }));
	}

	async function saveOne(key: string) {
		if (!activePath) return;
		const value = edits[key]; if (value === undefined) return;
		const token = window.prompt(`Confirm write to ${activePath} key ${key}. Paste confirmation token to proceed.`); if (!token) return;
		const res = await fetch("/api/env-browser", { method: "POST", headers: { "Content-Type": "application/json", "X-Cortex-Confirmation-Token": token }, body: JSON.stringify({ path: activePath, updates: [{ key, value }] }) });
		if (!res.ok) { const body = (await res.json()) as { error?: string }; setError(body.error ?? "Save failed"); return; }
		const data = (await res.json()) as { afterSha256: string }; setPostHash(data.afterSha256); setEdits((prev) => { const next = { ...prev }; delete next[key]; return next; }); await loadPath(activePath, true, "edit");
	}

	const columns = React.useMemo<ColumnDef<EnvFileRow>[]>(() => [
		{ accessorKey: "file", header: "File", cell: ({ row }) => <span className="font-mono text-xs">{row.original.file}</span> },
		{ accessorKey: "path", header: "Path", cell: ({ row }) => <span className="font-mono text-xs text-muted-foreground">{row.original.path}</span> },
		{ accessorKey: "group", header: "Group" },
		{ accessorKey: "exists", header: "Status", cell: ({ row }) => <span className={row.original.exists ? "text-xs text-emerald-400" : "text-xs text-muted-foreground"}>{row.original.exists ? "Present" : "Missing"}</span> },
		{ id: "actions", header: "", cell: ({ row }) => <div className="flex justify-end gap-1"><IconButton tooltip={`View ${row.original.file}`} onClick={() => loadPath(row.original.path, row.original.exists, "view")}><Eye className="size-4" /></IconButton><IconButton tooltip={`Edit ${row.original.file}`} variant="ghost" onClick={() => loadPath(row.original.path, row.original.exists, "edit")}><Pencil className="size-4" /></IconButton></div> },
	], [loadPath]);

	return (
		<div className="space-y-4">
			<DataTable columns={columns} data={rows} globalFilter={globalFilter} onGlobalFilterChange={setGlobalFilter} searchPlaceholder="Search env files..." noPagination />
			{error && <p className="text-sm text-destructive">{error}</p>}
			{postHash && <p className="font-mono text-xs text-muted-foreground">Post-write hash: {postHash.slice(0, 16)}…</p>}
			{!activePath && <EmptyState title="Select an env file" description="Use View or Edit to inspect an allowlisted env file." />}
			<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
				<DialogContent className="sm:max-w-4xl">
					<DialogHeader>
						<DialogTitle>{mode === "edit" ? "Edit env file" : "View env file"}</DialogTitle>
						<DialogDescription className="font-mono text-xs">{activePath}</DialogDescription>
					</DialogHeader>
					{missingPath ? (
						<p className="text-sm text-muted-foreground">File does not exist yet. Create it to configure this service.</p>
					) : lines.length === 0 ? (
						<p className="text-sm text-muted-foreground">File is empty.</p>
					) : (
						<div className="max-h-[70vh] overflow-auto rounded-lg border border-border">
							<table className="w-full text-sm">
								<thead className="sticky top-0 bg-popover text-xs text-muted-foreground">
									<tr><th className="px-2 py-2 text-left">Key</th><th className="px-2 py-2 text-left">Value</th><th className="px-2 py-2" /></tr>
								</thead>
								<tbody>
									{lines.map((l) => l.type === "kv" ? (
										<tr key={l.line} className="border-t border-border">
											<td className="px-2 py-1 font-mono text-xs">{l.key}</td>
											<td className="px-2 py-1">
												{mode === "edit" ? (
													<Input className="font-mono text-xs" value={edits[l.key!] !== undefined ? edits[l.key!] : revealed[l.key!] ?? l.masked ?? l.value ?? ""} onChange={(e) => setEdits((prev) => ({ ...prev, [l.key!]: e.target.value }))} />
												) : (
													<code className="block break-all rounded-md bg-muted/40 px-2 py-1 font-mono text-xs">{revealed[l.key!] ?? l.masked ?? l.value ?? ""}</code>
												)}
											</td>
											<td className="flex gap-1 px-2 py-1">
												{l.masked && revealed[l.key!] === undefined && <IconButton variant="ghost" tooltip={`Reveal ${l.key}`} onClick={() => reveal(l.key!)}><Eye className="size-3" /></IconButton>}
												{mode === "edit" && edits[l.key!] !== undefined && <IconButton tooltip={`Save ${l.key}`} onClick={() => saveOne(l.key!)}><Save className="size-3" /></IconButton>}
											</td>
										</tr>
									) : (
										<tr key={l.line} className="border-t border-border">
											<td className="px-2 py-1 font-mono text-xs text-muted-foreground" colSpan={3}>{l.type === "comment" ? l.value : ""}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</DialogContent>
			</Dialog>
		</div>
	);
}
