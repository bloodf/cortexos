"use client";

/**
 * Admin form for global Incus-wizard defaults + the AI model used for assist.
 * Persists to the `config` key/value table via /api/incus/settings.
 */
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Defaults {
	image: string;
	ghOrg: string;
	bridge: string;
	pool: string;
	branch: string;
	proxies: string[];
}

const EMPTY: Defaults = { image: "", ghOrg: "", bridge: "", pool: "", branch: "", proxies: [] };

export function IncusSettingsForm() {
	const [defaults, setDefaults] = useState<Defaults>(EMPTY);
	const [model, setModel] = useState("");
	const [models, setModels] = useState<string[]>([]);
	const [msg, setMsg] = useState<string | null>(null);
	const [err, setErr] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		fetch("/api/incus/settings", { cache: "no-store" })
			.then((r) => r.json())
			.then((j) => {
				if (j.data) {
					setDefaults({ ...EMPTY, ...j.data.defaults });
					setModel(j.data.model ?? "");
				}
			})
			.catch(() => {});
		fetch("/api/incus/ai/models", { cache: "no-store" })
			.then((r) => r.json())
			.then((j) => Array.isArray(j.data) && setModels(j.data))
			.catch(() => {});
	}, []);

	async function save() {
		setBusy(true); setErr(null); setMsg(null);
		try {
			const res = await fetch("/api/incus/settings", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ defaults, model }),
			});
			if (!res.ok) {
				const j = await res.json().catch(() => ({}));
				setErr(j.error || `Save failed (${res.status})`);
			} else {
				setMsg("Saved.");
			}
		} catch (e) {
			setErr(e instanceof Error ? e.message : "Save error");
		} finally {
			setBusy(false);
		}
	}

	function set<K extends keyof Defaults>(k: K, v: Defaults[K]) {
		setDefaults((d) => ({ ...d, [k]: v }));
	}

	return (
		<div className="space-y-4">
			<div className="grid grid-cols-2 gap-3">
				<Field label="Default image"><Input value={defaults.image} onChange={(e) => set("image", e.target.value)} /></Field>
				<Field label="Default GitHub org"><Input value={defaults.ghOrg} onChange={(e) => set("ghOrg", e.target.value)} /></Field>
				<Field label="Default bridge"><Input value={defaults.bridge} onChange={(e) => set("bridge", e.target.value)} /></Field>
				<Field label="Default pool"><Input value={defaults.pool} onChange={(e) => set("pool", e.target.value)} /></Field>
				<Field label="Default branch"><Input value={defaults.branch} onChange={(e) => set("branch", e.target.value)} /></Field>
			</div>

			<Field label="AI assist model (9router)">
				{models.length > 0 ? (
					<select
						value={model}
						onChange={(e) => setModel(e.target.value)}
						className="w-full text-sm bg-secondary border border-border rounded-md px-3 py-2 text-foreground"
					>
						<option value="">(none — AI assist disabled)</option>
						{models.map((m) => (
							<option key={m} value={m}>{m}</option>
						))}
					</select>
				) : (
					<Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="cx/gpt-5.5 (model list unavailable)" />
				)}
			</Field>

			{err && <Alert variant="destructive"><AlertDescription>{err}</AlertDescription></Alert>}
			{msg && <p className="text-sm text-muted-foreground">{msg}</p>}
			<Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save settings"}</Button>
		</div>
	);
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div className="space-y-1">
			<Label className="text-xs text-muted-foreground">{label}</Label>
			{children}
		</div>
	);
}
