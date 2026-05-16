"use client";

import { useEffect, useState } from "react";
import { Copy, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type EnvVar = { key: string; value: string; revealed?: boolean; source?: string };

export function EnvViewer({ serviceSlug }: { serviceSlug?: string }) {
	const [vars, setVars] = useState<EnvVar[]>([]);
	const [filter, setFilter] = useState("");
	const [revealed, setRevealed] = useState<Set<string>>(new Set());

	useEffect(() => {
		const q = serviceSlug ? `?service=${encodeURIComponent(serviceSlug)}` : "";
		fetch(`/api/env${q}`)
			.then((response) => response.json())
			.then((data) => setVars(data.vars || []))
			.catch(() => setVars([]));
	}, [serviceSlug]);

	const visible = vars.filter((item) => item.key.toLowerCase().includes(filter.toLowerCase()));

	return (
		<Card>
			<CardHeader>
				<CardTitle>Environment</CardTitle>
			</CardHeader>
			<CardContent className="space-y-3">
				<Input placeholder="Filter env vars" value={filter} onChange={(event) => setFilter(event.target.value)} />
				<div className="space-y-2">
					{visible.length === 0 && <p className="text-sm text-muted-foreground">No environment variables found.</p>}
					{visible.map((item) => {
						const isRevealed = revealed.has(item.key);
						const display = isRevealed ? item.value : "••••••";
						return (
							<div key={item.key} className="flex items-center justify-between gap-3 rounded-lg border border-border p-2 text-xs">
								<div className="min-w-0">
									<div className="font-mono font-medium">{item.key}</div>
									<div className="truncate font-mono text-muted-foreground">{display}</div>
								</div>
								<div className="flex shrink-0 gap-1">
									<Button type="button" variant="ghost" size="icon" aria-label={`Reveal ${item.key}`} onClick={() => setRevealed((prev) => { const next = new Set(prev); next.has(item.key) ? next.delete(item.key) : next.add(item.key); return next; })}>
										{isRevealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
									</Button>
									<Button type="button" variant="ghost" size="icon" aria-label={`Copy ${item.key}`} onClick={() => navigator.clipboard?.writeText(isRevealed ? item.value : display)}>
										<Copy className="h-3.5 w-3.5" />
									</Button>
								</div>
							</div>
						);
					})}
				</div>
			</CardContent>
		</Card>
	);
}
