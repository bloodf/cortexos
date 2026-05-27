"use client";

import * as React from "react";
import useSWR from "swr";
import { RefreshCw, PackageCheck, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface UpdateItem {
	id: string;
	name: string;
	manager: "apt" | "npm";
	currentVersion?: string;
	latestVersion?: string;
	description?: string;
	restartServices?: string[];
}

const fetcher = async (url: string) => {
	const res = await fetch(url, { cache: "no-store" });
	const body = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
	return body;
};

export function PackageUpdatesPanel() {
	const { data, error, mutate, isLoading } = useSWR<{ updates: UpdateItem[]; error?: string }>("/api/updates", fetcher);
	const [serviceMap, setServiceMap] = React.useState<Record<string, string>>({});
	const [running, setRunning] = React.useState<string | null>(null);
	const [message, setMessage] = React.useState<string | null>(null);
	const updates = data?.updates ?? [];

	async function applyUpdate(item: UpdateItem) {
		setRunning(item.id);
		setMessage(null);
		try {
			const restartServices = (serviceMap[item.id] ?? item.restartServices?.join(",") ?? "")
				.split(",")
				.map((service) => service.trim())
				.filter(Boolean);
			const res = await fetch("/api/updates", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ manager: item.manager, name: item.name, restartServices }),
			});
			const body = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
			setMessage(`${item.name} updated${restartServices.length ? ` and ${restartServices.join(", ")} restarted` : ""}.`);
			await mutate();
		} catch (error) {
			setMessage(error instanceof Error ? error.message : "Update failed");
		} finally {
			setRunning(null);
		}
	}

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="grid grid-cols-3 gap-2">
					<Summary label="Updates" value={updates.length} />
					<Summary label="APT" value={updates.filter((u) => u.manager === "apt").length} />
					<Summary label="npm" value={updates.filter((u) => u.manager === "npm").length} />
				</div>
				<Button variant="outline" onClick={() => mutate()} disabled={isLoading}>
					<RefreshCw className="size-4" />
					Check now
				</Button>
			</div>
			{(message || error) && <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">{message || (error instanceof Error ? error.message : "Failed to check updates")}</p>}
			<div className="overflow-hidden rounded-lg border border-border">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Package</TableHead>
							<TableHead>Manager</TableHead>
							<TableHead>Installed</TableHead>
							<TableHead>Available</TableHead>
							<TableHead>Restart service after update</TableHead>
							<TableHead className="text-right">Action</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{updates.length === 0 ? (
							<TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">{isLoading ? "Checking for updates..." : "No package updates detected."}</TableCell></TableRow>
						) : updates.map((item) => (
							<TableRow key={item.id}>
								<TableCell><div className="font-medium">{item.name}</div><div className="text-xs text-muted-foreground">{item.description}</div></TableCell>
								<TableCell><span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium">{item.manager}</span></TableCell>
								<TableCell className="font-mono text-xs">{item.currentVersion ?? "unknown"}</TableCell>
								<TableCell className="font-mono text-xs">{item.latestVersion ?? "latest"}</TableCell>
								<TableCell>
									<Input
										placeholder="optional systemd unit"
										value={serviceMap[item.id] ?? item.restartServices?.join(", ") ?? ""}
										onChange={(event) => setServiceMap((prev) => ({ ...prev, [item.id]: event.target.value }))}
									/>
								</TableCell>
								<TableCell className="text-right">
									<Button size="sm" onClick={() => applyUpdate(item)} disabled={running !== null}>
										{serviceMap[item.id] ? <RotateCcw className="size-3.5" /> : <PackageCheck className="size-3.5" />}
										{running === item.id ? "Updating..." : "Update"}
									</Button>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>
		</div>
	);
}

function Summary({ label, value }: { label: string; value: number }) {
	return <div className="rounded-lg border border-border bg-card px-3 py-2"><div className="text-lg font-semibold tabular-nums">{value}</div><div className="text-xs text-muted-foreground">{label}</div></div>;
}
