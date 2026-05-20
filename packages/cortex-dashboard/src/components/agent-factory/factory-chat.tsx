"use client";

import * as React from "react";
import { useChat } from "@ai-sdk/react";
import type { FileUIPart } from "ai";
import { DefaultChatTransport } from "ai";
import { ImagePlus, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

interface FactorySummary { id: number; slug: string; name: string; kind: string; schema_version: number }
interface Props { factories: FactorySummary[] }
const MODELS = [
	{ id: "cx/gpt-5.5", label: "gpt-5.5" },
	{ id: "cc/claude-opus-4-7", label: "Opus 4.7" },
	{ id: "kimi/kimi-k2.6", label: "K2.6" },
	{ id: "minimax/MiniMax-M2.7", label: "Minimax 2.7" },
];
async function fileToDataUrl(file: File): Promise<string> { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file); }); }
function messageText(message: { parts?: unknown[] }): string { return (message.parts ?? []).map((part) => typeof part === "object" && part !== null && "text" in part ? String((part as { text?: unknown }).text ?? "") : "").join(""); }

export function FactoryChat({ factories }: Props) {
	const [modelId, setModelId] = React.useState(MODELS[0].id);
	const [reasoning, setReasoning] = React.useState(true);
	const [effort, setEffort] = React.useState("medium");
	const [images, setImages] = React.useState<FileUIPart[]>([]);
	const [input, setInput] = React.useState("");
	const fileRef = React.useRef<HTMLInputElement>(null);
	const transport = React.useMemo(() => new DefaultChatTransport({ api: "/api/ai/chat", body: () => ({ modelId, reasoning, effort, sessionId: "agent-factory" }) }), [modelId, reasoning, effort]);
	const chat = useChat({ transport });
	const busy = chat.status === "submitted" || chat.status === "streaming";
	async function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); const text = input.trim(); if (!text && images.length === 0) return; setInput(""); await chat.sendMessage?.(images.length > 0 ? { text, files: images } : { text }); setImages([]); }
	async function pickFiles(files: FileList | null) { if (!files) return; const next = await Promise.all(Array.from(files).filter((file) => file.type.startsWith("image/")).map(async (file) => ({ type: "file" as const, mediaType: file.type, filename: file.name, url: await fileToDataUrl(file) }))); setImages((prev) => [...prev, ...next]); }
	return <div className="grid h-[calc(100vh-220px)] min-h-[680px] gap-4 md:grid-cols-[280px_1fr]"><aside className="min-h-0 overflow-y-auto rounded-lg border border-border p-3"><h2 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Factory registry</h2>{factories.length === 0 ? <p className="text-xs text-muted-foreground">No factories yet.</p> : <ul className="space-y-1">{factories.map((factory) => <li key={factory.id} className="rounded-md border border-border p-2"><div className="truncate text-sm font-medium">{factory.name}</div><div className="truncate font-mono text-[10px] text-muted-foreground">{factory.slug} · {factory.kind}</div></li>)}</ul>}</aside><main className="flex min-h-0 flex-col rounded-lg border border-border"><div className="flex flex-wrap items-center gap-3 border-b border-border p-3"><Select value={modelId} onValueChange={(value) => value && setModelId(value)}><SelectTrigger className="w-64"><SelectValue /></SelectTrigger><SelectContent>{MODELS.map((model) => <SelectItem key={model.id} value={model.id}>{model.label}</SelectItem>)}</SelectContent></Select><label className="flex items-center gap-2 text-sm"><Switch checked={reasoning} onCheckedChange={setReasoning} />Reasoning</label><Select value={effort} onValueChange={(value) => value && setEffort(value)}><SelectTrigger className="w-32"><SelectValue /></SelectTrigger><SelectContent>{["low", "medium", "high"].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select><input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(event) => pickFiles(event.target.files)} /><Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}><ImagePlus className="mr-1 size-4" />Image</Button></div><div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">{chat.messages.length === 0 && <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">Describe the startup/company you want. The factory assistant will produce a Paperclip-aligned organization with seats, positions, agents, and project lane metadata.</div>}{chat.messages.map((message) => <div key={message.id} className={message.role === "user" ? "ml-auto max-w-[80%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground" : "mr-auto max-w-[80%] rounded-lg bg-muted px-3 py-2 text-sm whitespace-pre-wrap"}>{messageText(message)}</div>)}</div>{images.length > 0 && <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground">{images.length} image{images.length === 1 ? "" : "s"} staged</div>}<form onSubmit={submit} className="flex shrink-0 gap-2 border-t border-border p-3"><Input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Create a startup company for Paperclip with CEO, PM, engineering, QA, design..." disabled={busy} /><Button type="submit" disabled={busy || (!input.trim() && images.length === 0)}><Send className="size-4" /></Button></form></main></div>;
}
