"use client";

/**
 * Polls the provisioning status route and renders per-step progress while the
 * canonical script runs. The provision POST is in flight concurrently; this
 * component reads the on-disk progress log via the status endpoint.
 */
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ProgressStep {
	step: string;
	status: string;
	n?: number;
	total?: number;
	detail?: string;
}

const TERMINAL = new Set(["active", "failed"]);

export function ProvisionProgress({
	name,
	requestId,
	onDone,
}: {
	name: string;
	requestId: string;
	onDone: () => void;
}) {
	const [steps, setSteps] = useState<ProgressStep[]>([]);
	const [status, setStatus] = useState<string>("provisioning");

	useEffect(() => {
		let active = true;
		const poll = async () => {
			try {
				const res = await fetch(
					`/api/incus/instances/${encodeURIComponent(name)}/provision/status?requestId=${encodeURIComponent(requestId)}`,
					{ cache: "no-store" },
				);
				const j = await res.json();
				if (!active) return;
				if (j.data) {
					setSteps(j.data.steps ?? []);
					setStatus(j.data.status ?? "provisioning");
				}
			} catch {
				/* keep polling */
			}
		};
		poll();
		const id = setInterval(() => {
			if (TERMINAL.has(status)) return;
			poll();
		}, 1500);
		return () => {
			active = false;
			clearInterval(id);
		};
	}, [name, requestId, status]);

	const done = TERMINAL.has(status);

	return (
		<Card>
			<CardHeader className="flex-row items-center justify-between">
				<CardTitle>Provisioning {name}</CardTitle>
				<Badge variant={status === "failed" ? "destructive" : status === "active" ? "default" : "secondary"}>
					{status}
				</Badge>
			</CardHeader>
			<CardContent className="space-y-2">
				{steps.length === 0 && !done && <p className="text-sm text-muted-foreground">Starting…</p>}
				<ol className="space-y-1">
					{steps.map((s, i) => (
						<li key={`${s.step}-${i}`} className="text-sm flex items-center gap-2">
							<Badge variant={s.status === "error" ? "destructive" : s.status === "done" ? "default" : "secondary"}>
								{s.n ?? "·"}
							</Badge>
							<span className="font-mono text-xs">{s.step}</span>
							{s.detail && <span className="text-muted-foreground text-xs">— {s.detail}</span>}
						</li>
					))}
				</ol>
				{done && (
					<div className="pt-2">
						<Button onClick={onDone}>{status === "active" ? "Done" : "Back to Incus"}</Button>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
