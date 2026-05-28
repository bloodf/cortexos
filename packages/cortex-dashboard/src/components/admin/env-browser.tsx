"use client";

import * as React from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { Eye, Save } from "lucide-react";

// Fixed allowlist paths grouped by tab (matches `src/lib/secrets/allowlist.ts`).
const PATH_GROUPS: { id: string; label: string; paths: string[] }[] = [
	{
		id: "host",
		label: "Host",
		paths: [
			"/opt/cortexos/.secrets/9router.env",
			"/opt/cortexos/.secrets/dashboard.env",
		],
	},
	{
		id: "systemd",
		label: "Systemd",
		paths: ["/etc/systemd/system/cortex-dashboard.service.d/override.conf"],
	},
	{
		id: "docker",
		label: "Docker",
		paths: [
			"/opt/cortexos/stacks/postgresql/.env",
			"/opt/cortexos/stacks/redis/.env",
			"/opt/cortexos/stacks/mongodb/.env",
			"/opt/cortexos/stacks/honcho/.env",
		],
	},
];

interface EnvLine {
	line: number;
	type: "kv" | "comment" | "blank";
	key?: string;
	value?: string;
	masked?: string;
}

export function EnvBrowser() {
	const [tab, setTab] = React.useState("host");
	const [activePath, setActivePath] = React.useState<string | null>(null);
	const [lines, setLines] = React.useState<EnvLine[]>([]);
	const [edits, setEdits] = React.useState<Record<string, string>>({});
	const [revealed, setRevealed] = React.useState<Record<string, string>>({});
	const [postHash, setPostHash] = React.useState<string | null>(null);
	const [error, setError] = React.useState<string | null>(null);

	const loadPath = React.useCallback(async (p: string) => {
		setActivePath(p);
		setLines([]);
		setEdits({});
		setRevealed({});
		setPostHash(null);
		setError(null);
		try {
			const res = await fetch(`/api/env-browser?path=${encodeURIComponent(p)}`);
			if (!res.ok) {
				const body = (await res.json()) as { error?: string };
				setError(body.error ?? `HTTP ${res.status}`);
				return;
			}
			const data = (await res.json()) as { lines: EnvLine[] };
			setLines(data.lines.filter((l) => l.type === "kv"));
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load");
		}
	}, []);

	async function reveal(key: string) {
		if (!activePath) return;
		const token = window.prompt(
			`Reveal "${key}"? Type "REVEAL" to confirm. This action is audit-logged.`,
		);
		if (token !== "REVEAL") return;
		const res = await fetch(
			`/api/env-browser?path=${encodeURIComponent(activePath)}&reveal=true&keys=${encodeURIComponent(key)}`,
		);
		if (!res.ok) {
			const body = (await res.json()) as { error?: string };
			setError(body.error ?? "Reveal failed");
			return;
		}
		const data = (await res.json()) as { keys: Record<string, string | null> };
		setRevealed((prev) => ({ ...prev, [key]: data.keys[key] ?? "" }));
	}

	async function saveOne(key: string) {
		if (!activePath) return;
		const value = edits[key];
		if (value === undefined) return;
		const token = window.prompt(
			`Confirm write to ${activePath} key ${key}. Paste confirmation token to proceed.`,
		);
		if (!token) return;
		const res = await fetch("/api/env-browser", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Cortex-Confirmation-Token": token,
			},
			body: JSON.stringify({ path: activePath, updates: [{ key, value }] }),
		});
		if (!res.ok) {
			const body = (await res.json()) as { error?: string };
			setError(body.error ?? "Save failed");
			return;
		}
		const data = (await res.json()) as { afterSha256: string };
		setPostHash(data.afterSha256);
		setEdits((prev) => {
			const next = { ...prev };
			delete next[key];
			return next;
		});
		await loadPath(activePath);
	}

	return (
		<Tabs value={tab} onValueChange={setTab}>
			<TabsList>
				{PATH_GROUPS.map((g) => (
					<TabsTrigger key={g.id} value={g.id}>
						{g.label}
					</TabsTrigger>
				))}
			</TabsList>
			{PATH_GROUPS.map((g) => (
				<TabsContent key={g.id} value={g.id}>
					<div className="flex gap-4">
						<aside className="w-64 shrink-0 space-y-1 border-r border-border pr-3">
							{g.paths.map((p) => (
								<button
									key={p}
									type="button"
									onClick={() => loadPath(p)}
									className={`block w-full truncate rounded-md px-2 py-1.5 text-left text-xs font-mono ${
										activePath === p
											? "bg-secondary text-foreground"
											: "text-muted-foreground hover:bg-muted"
									}`}
								>
									{p}
								</button>
							))}
						</aside>
						<div className="min-w-0 flex-1 space-y-3">
							{!activePath && (
								<EmptyState
									title="Select a path"
									description="Pick a file from the left to browse."
								/>
							)}
							{error && <p className="text-sm text-destructive">{error}</p>}
							{postHash && (
								<p className="text-xs text-muted-foreground font-mono">
									Post-write hash: {postHash.slice(0, 16)}…
								</p>
							)}
							{activePath && lines.length > 0 && (
								<table className="w-full text-sm">
									<thead className="text-xs text-muted-foreground">
										<tr>
											<th className="px-2 py-1 text-left">Key</th>
											<th className="px-2 py-1 text-left">Value</th>
											<th className="px-2 py-1" />
										</tr>
									</thead>
									<tbody>
										{lines.map((l) => (
											<tr key={l.line} className="border-t border-border">
												<td className="px-2 py-1 font-mono text-xs">{l.key}</td>
												<td className="px-2 py-1">
													<Input
														className="font-mono text-xs"
														value={
															edits[l.key!] !== undefined
																? edits[l.key!]
																: revealed[l.key!] ?? l.masked ?? l.value ?? ""
														}
														onChange={(e) =>
															setEdits((prev) => ({ ...prev, [l.key!]: e.target.value }))
														}
													/>
												</td>
												<td className="flex gap-1 px-2 py-1">
													{l.masked && revealed[l.key!] === undefined && (
														<Button size="sm" variant="ghost" onClick={() => reveal(l.key!)}>
															<Eye className="size-3" />
														</Button>
													)}
													{edits[l.key!] !== undefined && (
														<Button size="sm" onClick={() => saveOne(l.key!)}>
															<Save className="size-3" />
														</Button>
													)}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							)}
						</div>
					</div>
				</TabsContent>
			))}
		</Tabs>
	);
}
