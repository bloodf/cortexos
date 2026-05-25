"use client";

import { useCallback, useMemo, useState } from "react";
import useSWR, { mutate } from "swr";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface FileInfo { id: string; name: string; path: string }
interface Props { slug: string; files: FileInfo[] }
const fetcher = async (url: string) => {
	const res = await fetch(url);
	const body = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
	return body;
};

export function AgentFileViewer({ slug, files }: Props) {
	const [activeFile, setActiveFile] = useState(files[0]?.id ?? "");
	const [editedContent, setEditedContent] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const [saveError, setSaveError] = useState<string | null>(null);
	const apiUrl = activeFile ? `/api/agents/${slug}/files/${encodeURIComponent(activeFile)}` : null;
	const { data, error, isLoading } = useSWR(apiUrl, fetcher);

	const loadedContent = data?.content ?? "";
	const draft = editedContent ?? loadedContent;
	const dirty = editedContent !== null && editedContent !== loadedContent;
	const selectedFile = useMemo(() => files.find((file) => file.id === activeFile), [activeFile, files]);

	const saveEdit = useCallback(async () => {
		if (!apiUrl || !dirty) return;
		setSaving(true); setSaveError(null);
		try { const res = await fetch(apiUrl, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: draft }) }); if (!res.ok) { const body = await res.json().catch(() => ({})); throw new Error(body.error || `Save failed (${res.status})`); } await mutate(apiUrl); setEditedContent(null); }
		catch (err) { setSaveError(err instanceof Error ? err.message : "Save failed"); }
		finally { setSaving(false); }
	}, [apiUrl, dirty, draft]);

	if (files.length === 0) return <p className="text-sm text-muted-foreground">No .md files found for this agent.</p>;
	return <div className="space-y-4"><div className="flex gap-2 overflow-x-auto"><div className="flex rounded-md border border-border p-0.5">{files.map((file) => <button key={file.id} type="button" onClick={() => { setActiveFile(file.id); setEditedContent(null); setSaveError(null); }} className={`shrink-0 rounded px-3 py-1.5 font-mono text-xs transition-colors ${activeFile === file.id ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>{file.name}</button>)}</div></div><div className="overflow-hidden rounded-xl border border-border bg-card"><div className="flex items-center justify-between border-b border-border px-4 py-2"><span className="font-mono text-xs text-muted-foreground">{selectedFile?.path ?? selectedFile?.name ?? activeFile}</span><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => { setEditedContent(null); setSaveError(null); }} disabled={!dirty || saving}>Reset</Button><Button size="sm" onClick={saveEdit} disabled={!dirty || saving}>{saving ? "Saving…" : "Save"}</Button></div></div>{saveError && <div className="border-b border-red-500/20 bg-red-500/10 px-4 py-2 text-xs text-red-400">{saveError}</div>}{isLoading ? <div className="p-4 text-sm text-muted-foreground">Loading…</div> : error ? <div className="p-4 text-sm text-red-400">Failed to load file content.</div> : <Textarea value={draft} onChange={(event) => { setEditedContent(event.target.value); }} className="min-h-[560px] resize-y rounded-none border-0 bg-transparent font-mono text-sm focus-visible:ring-0" spellCheck={false} />}</div></div>;
}
