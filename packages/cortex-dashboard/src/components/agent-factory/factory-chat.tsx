"use client";

import * as React from "react";
import { useChat } from "@ai-sdk/react";
import type { FileUIPart } from "ai";
import { DefaultChatTransport } from "ai";
import { ImagePlus, Plus, Save, Send } from "lucide-react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

interface FactorySummary { id: number; slug: string; name: string; kind: string; schema_version: number; definition?: Record<string, unknown> }
interface Props { factories: FactorySummary[] }
const MODELS = [
	{ id: "cx/gpt-5.5", label: "gpt-5.5" },
	{ id: "cc/claude-opus-4-7", label: "Opus 4.7" },
	{ id: "kimi/kimi-k2.6", label: "K2.6" },
	{ id: "glm/glm-5.1", label: "GLM-5.1" },
	{ id: "minimax/MiniMax-M2.7", label: "Minimax 2.7" },
];
const fetcher = (url: string) => fetch(url).then((r) => r.json());
async function fileToDataUrl(file: File): Promise<string> { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file); }); }
function messageText(message: { parts?: unknown[] }): string { return (message.parts ?? []).map((part) => typeof part === "object" && part !== null && "text" in part ? String((part as { text?: unknown }).text ?? "") : "").join(""); }
function emptyFactory(): FactorySummary { return { id: 0, slug: "", name: "", kind: "role", schema_version: 1, definition: {} }; }
function mdFile(factory: FactorySummary): string {
	const role = factory.definition?.paperclip && typeof factory.definition.paperclip === "object" ? (factory.definition.paperclip as Record<string, unknown>).paperclip_role : undefined;
	const raw = factory.kind === "role" && typeof role === "string" ? role : typeof factory.definition?.markdownFile === "string" ? factory.definition.markdownFile : factory.kind === "project" ? "README.md" : `${factory.slug.toUpperCase().replace(/-/g, "_")}.md`;
	return raw.endsWith(".md") ? raw : `${raw}.md`;
}

export function FactoryChat({ factories }: Props) {
	const { data, mutate } = useSWR<{ factories: FactorySummary[] }>("/api/agent-factory", fetcher, { fallbackData: { factories } });
	const registry = data?.factories ?? factories;
	const [selected, setSelected] = React.useState<FactorySummary | null>(null);
	const [draft, setDraft] = React.useState(emptyFactory());
	const [definitionText, setDefinitionText] = React.useState("{}");
	const [markdownText, setMarkdownText] = React.useState("");
	const [markdownEdit, setMarkdownEdit] = React.useState(false);
	const [saveError, setSaveError] = React.useState<string | null>(null);
	const [modelId, setModelId] = React.useState(MODELS[0].id);
	const [reasoning, setReasoning] = React.useState(true);
	const [effort, setEffort] = React.useState("medium");
	const [images, setImages] = React.useState<FileUIPart[]>([]);
	const [input, setInput] = React.useState("");
	const fileRef = React.useRef<HTMLInputElement>(null);
	const transport = React.useMemo(() => new DefaultChatTransport({ api: "/api/ai/chat", body: () => ({ modelId, reasoning, effort, sessionId: "agent-factory" }) }), [modelId, reasoning, effort]);
	const chat = useChat({ transport });
	const busy = chat.status === "submitted" || chat.status === "streaming";

	async function loadMarkdown(factory: FactorySummary) {
		if (factory.kind !== "role" && factory.kind !== "project") { setMarkdownText(""); return; }
		const res = await fetch(`/api/agent-factory?markdown=${encodeURIComponent(mdFile(factory))}`);
		if (!res.ok) { setMarkdownText(""); return; }
		const body = await res.json() as { content?: string };
		setMarkdownText(body.content ?? "");
	}
	function openFactory(factory: FactorySummary) { setSelected(factory); setDraft(factory); setDefinitionText(JSON.stringify(factory.definition ?? {}, null, 2)); setMarkdownEdit(false); setSaveError(null); void loadMarkdown(factory); }
	function openNewFactory() { const factory = emptyFactory(); setSelected(factory); setDraft(factory); setDefinitionText("{}"); setMarkdownText(""); setMarkdownEdit(false); setSaveError(null); }
	async function saveFactory() {
		let definition: Record<string, unknown>;
		try { definition = JSON.parse(definitionText) as Record<string, unknown>; } catch { setSaveError("Definition must be valid JSON."); return; }
		const method = draft.id === 0 ? "POST" : "PUT";
		const url = draft.id === 0 ? "/api/agent-factory" : `/api/agent-factory?slug=${encodeURIComponent(draft.slug)}`;
		const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...draft, definition }) });
		if (!res.ok) { const body = await res.json().catch(() => ({})) as { error?: string }; setSaveError(body.error ?? `HTTP ${res.status}`); return; }
		const body = await res.json() as { factory: FactorySummary };
		setSelected(body.factory); setDraft(body.factory); setDefinitionText(JSON.stringify(body.factory.definition ?? {}, null, 2)); await mutate();
	}
	async function saveMarkdown() {
		const res = await fetch(`/api/agent-factory?slug=${encodeURIComponent(draft.slug)}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ markdownFile: mdFile(draft), markdownContent: markdownText }) });
		if (!res.ok) { const body = await res.json().catch(() => ({})) as { error?: string }; setSaveError(body.error ?? `HTTP ${res.status}`); return; }
		setMarkdownEdit(false);
	}
	async function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); const text = input.trim(); if (!text && images.length === 0) return; setInput(""); await chat.sendMessage?.(images.length > 0 ? { text, files: images } : { text }); setImages([]); }
	async function pickFiles(files: FileList | null) { if (!files) return; const next = await Promise.all(Array.from(files).filter((file) => file.type.startsWith("image/")).map(async (file) => ({ type: "file" as const, mediaType: file.type, filename: file.name, url: await fileToDataUrl(file) }))); setImages((prev) => [...prev, ...next]); }

	return <div className="grid h-[calc(100vh-220px)] min-h-[680px] gap-4 md:grid-cols-[280px_1fr]"><aside className="min-h-0 overflow-y-auto rounded-lg border border-border p-3"><div className="mb-2 flex items-center justify-between gap-2"><h2 className="text-xs font-semibold uppercase text-muted-foreground">Factory registry</h2><Button type="button" variant="outline" size="sm" onClick={openNewFactory}><Plus className="mr-1 size-3" />New</Button></div>{registry.length === 0 ? <p className="text-xs text-muted-foreground">No factories yet.</p> : <ul className="space-y-1">{registry.map((factory) => <li key={factory.id}><button type="button" onClick={() => openFactory(factory)} className="w-full rounded-md border border-border p-2 text-left hover:bg-muted"><div className="truncate text-sm font-medium">{factory.name}</div><div className="truncate font-mono text-[10px] text-muted-foreground">{factory.slug} · {factory.kind}</div></button></li>)}</ul>}</aside><main className="flex min-h-0 flex-col rounded-lg border border-border"><div className="flex flex-wrap items-center gap-3 border-b border-border p-3"><Select value={modelId} onValueChange={(value) => value && setModelId(value)}><SelectTrigger className="w-64"><SelectValue /></SelectTrigger><SelectContent>{MODELS.map((model) => <SelectItem key={model.id} value={model.id}>{model.label}</SelectItem>)}</SelectContent></Select><label className="flex items-center gap-2 text-sm"><Switch checked={reasoning} onCheckedChange={setReasoning} />Reasoning</label><Select value={effort} onValueChange={(value) => value && setEffort(value)}><SelectTrigger className="w-32"><SelectValue /></SelectTrigger><SelectContent>{["low", "medium", "high"].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select><input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(event) => pickFiles(event.target.files)} /><Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}><ImagePlus className="mr-1 size-4" />Image</Button></div><div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">{chat.messages.length === 0 && <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">Describe the startup/company you want. The factory assistant will produce a Paperclip-aligned organization with seats, positions, agents, and project lane metadata.</div>}{chat.messages.map((message) => <div key={message.id} className={message.role === "user" ? "ml-auto max-w-[80%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground" : "mr-auto max-w-[80%] rounded-lg bg-muted px-3 py-2 text-sm whitespace-pre-wrap"}>{messageText(message)}</div>)}</div>{images.length > 0 && <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground">{images.length} image{images.length === 1 ? "" : "s"} staged</div>}<form onSubmit={submit} className="flex shrink-0 gap-2 border-t border-border p-3"><Input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Create a startup company for Paperclip with CEO, PM, engineering, QA, design..." disabled={busy} /><Button type="submit" disabled={busy || (!input.trim() && images.length === 0)}><Send className="size-4" /></Button></form></main><Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}><DialogContent className="max-w-3xl"><DialogHeader><DialogTitle>{draft.id === 0 ? "New Factory" : draft.name}</DialogTitle></DialogHeader><div className="grid gap-3"><div className="grid grid-cols-2 gap-2"><Input value={draft.slug} placeholder="slug" disabled={draft.id !== 0} onChange={(event) => setDraft((prev) => ({ ...prev, slug: event.target.value }))} /><Input value={draft.name} placeholder="Name" onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))} /></div><div className="grid grid-cols-2 gap-2"><Select value={draft.kind} onValueChange={(value) => value && setDraft((prev) => ({ ...prev, kind: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["role", "workflow", "pipeline", "project"].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select><Input type="number" min={1} value={draft.schema_version} onChange={(event) => setDraft((prev) => ({ ...prev, schema_version: Number(event.target.value) || 1 }))} /></div><textarea className="min-h-[220px] rounded-md border border-input bg-background p-2 font-mono text-xs" value={definitionText} onChange={(event) => setDefinitionText(event.target.value)} />{draft.kind === "role" && <section className="space-y-2 rounded-md border border-border p-3"><div className="flex items-center justify-between"><h3 className="font-mono text-xs text-muted-foreground">{mdFile(draft)}</h3><Button type="button" variant="outline" size="sm" onClick={() => setMarkdownEdit((v) => !v)}>{markdownEdit ? "Preview" : "Edit markdown"}</Button></div>{markdownEdit ? <textarea className="min-h-[260px] w-full rounded-md border border-input bg-background p-2 font-mono text-xs" value={markdownText} onChange={(event) => setMarkdownText(event.target.value)} /> : <pre className="max-h-[320px] overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">{markdownText || "No markdown file found."}</pre>}<div className="flex justify-end"><Button type="button" variant="outline" size="sm" onClick={saveMarkdown}><Save className="mr-1 size-4" />Save Markdown</Button></div></section>}{saveError && <p className="text-sm text-destructive">{saveError}</p>}<div className="flex justify-end"><Button type="button" onClick={saveFactory}><Save className="mr-1 size-4" />Save Factory</Button></div></div></DialogContent></Dialog></div>;
}
