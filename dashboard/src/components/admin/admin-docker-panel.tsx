"use client";

import * as React from "react";
import useSWR from "swr";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

interface Container {
	ID: string;
	Names: string;
	Image: string;
	State: string;
	Status: string;
	Ports: string;
}

interface Image {
	ID: string;
	Repository: string;
	Tag: string;
	Size: string;
	CreatedSince: string;
}

interface Volume {
	Name: string;
	Driver: string;
	Mountpoint: string;
}

interface DockerResult<T> {
	data: T[];
	error?: string;
}

interface DockerData {
	containers: DockerResult<Container>;
	volumes: DockerResult<Volume>;
	images: DockerResult<Image>;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const PRUNE_TARGETS = ["containers", "images", "volumes", "networks"] as const;
type PruneTarget = (typeof PRUNE_TARGETS)[number];

export function AdminDockerPanel() {
	const { data, mutate } = useSWR<DockerData>("/api/docker", fetcher, {
		refreshInterval: 5_000,
	});
	const [tab, setTab] = React.useState("containers");
	const [pruning, setPruning] = React.useState<PruneTarget | null>(null);
	const [err, setErr] = React.useState<string | null>(null);

	const containers = data?.containers?.data ?? [];
	const images = data?.images?.data ?? [];
	const volumes = data?.volumes?.data ?? [];

	async function prune(target: PruneTarget) {
		setErr(null);
		try {
			const res = await fetch("/api/docker/actions", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ action: "prune", target }),
			});
			if (!res.ok) {
				const body = (await res.json().catch(() => ({}))) as { error?: string };
				throw new Error(body.error ?? `HTTP ${res.status}`);
			}
			await mutate();
		} catch (e) {
			setErr(e instanceof Error ? e.message : "Prune failed");
		} finally {
			setPruning(null);
		}
	}

	return (
		<div className="space-y-4">
			{err && (
				<p className="text-sm text-destructive" role="alert">
					{err}
				</p>
			)}
			<Tabs value={tab} onValueChange={setTab}>
				<TabsList>
					<TabsTrigger value="containers">
						Containers ({containers.length})
					</TabsTrigger>
					<TabsTrigger value="images">Images ({images.length})</TabsTrigger>
					<TabsTrigger value="volumes">Volumes ({volumes.length})</TabsTrigger>
					<TabsTrigger value="networks">Networks</TabsTrigger>
				</TabsList>

				<TabsContent value="containers">
					<div className="flex justify-end pb-2">
						<Button size="sm" variant="outline" onClick={() => setPruning("containers")}>
							Prune stopped
						</Button>
					</div>
					{containers.length === 0 ? (
						<EmptyState title="No containers" description="No containers found." />
					) : (
						<SimpleTable
							columns={["Name", "Image", "State", "Ports"]}
							rows={containers.map((c) => [
								<span key="n" className="font-mono text-xs">
									{c.Names}
								</span>,
								<span key="i" className="text-xs">
									{c.Image}
								</span>,
								<span key="s" className="text-xs">
									{c.Status}
								</span>,
								<span key="p" className="font-mono text-xs">
									{c.Ports || "—"}
								</span>,
							])}
						/>
					)}
				</TabsContent>

				<TabsContent value="images">
					<div className="flex justify-end pb-2">
						<Button size="sm" variant="outline" onClick={() => setPruning("images")}>
							Prune dangling
						</Button>
					</div>
					{images.length === 0 ? (
						<EmptyState title="No images" description="No images found." />
					) : (
						<SimpleTable
							columns={["Repository", "Tag", "Size", "Created"]}
							rows={images.map((i) => [
								<span key="r" className="text-xs">
									{i.Repository}
								</span>,
								<span key="t" className="font-mono text-xs">
									{i.Tag}
								</span>,
								<span key="s" className="font-mono text-xs">
									{i.Size}
								</span>,
								<span key="c" className="text-xs">
									{i.CreatedSince}
								</span>,
							])}
						/>
					)}
				</TabsContent>

				<TabsContent value="volumes">
					<div className="flex justify-end pb-2">
						<Button size="sm" variant="outline" onClick={() => setPruning("volumes")}>
							Prune unused
						</Button>
					</div>
					{volumes.length === 0 ? (
						<EmptyState title="No volumes" description="No volumes found." />
					) : (
						<SimpleTable
							columns={["Name", "Driver", "Mountpoint"]}
							rows={volumes.map((v) => [
								<span key="n" className="font-mono text-xs">
									{v.Name}
								</span>,
								<span key="d" className="text-xs">
									{v.Driver}
								</span>,
								<span key="m" className="font-mono text-xs truncate max-w-[300px] block">
									{v.Mountpoint}
								</span>,
							])}
						/>
					)}
				</TabsContent>

				<TabsContent value="networks">
					<div className="flex justify-end pb-2">
						<Button size="sm" variant="outline" onClick={() => setPruning("networks")}>
							Prune unused
						</Button>
					</div>
					<EmptyState
						title="Network listing"
						description="Network listing not yet exposed; use prune to remove unused networks."
					/>
				</TabsContent>
			</Tabs>

			{pruning && (
				<Dialog open onOpenChange={() => setPruning(null)}>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Prune {pruning}?</DialogTitle>
						</DialogHeader>
						<p className="text-sm text-muted-foreground">
							This runs <code className="font-mono">docker {pruning} prune -f</code> on the
							host and is audit-logged. Action is irreversible.
						</p>
						<div className="flex justify-end gap-2 pt-3">
							<Button variant="outline" size="sm" onClick={() => setPruning(null)}>
								Cancel
							</Button>
							<Button variant="destructive" size="sm" onClick={() => prune(pruning)}>
								Confirm prune
							</Button>
						</div>
					</DialogContent>
				</Dialog>
			)}
		</div>
	);
}

function SimpleTable({
	columns,
	rows,
}: {
	columns: string[];
	rows: React.ReactNode[][];
}) {
	return (
		<div className="overflow-x-auto rounded-md border border-border">
			<table className="w-full text-sm">
				<thead className="bg-muted/50">
					<tr>
						{columns.map((c) => (
							<th
								key={c}
								className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
							>
								{c}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{rows.map((cells, ri) => (
						<tr key={ri} className="border-t border-border">
							{cells.map((cell, ci) => (
								<td key={ci} className="px-3 py-2">
									{cell}
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
