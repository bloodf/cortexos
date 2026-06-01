"use client";

/**
 * Lists saved Incus instance configs (from the wizard) with lifecycle status.
 * Distinct from the live container list in incus-table.tsx.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SavedConfig {
	id: number;
	name: string;
	slug: string | null;
	status: string;
	created_by: string | null;
	created_at: string;
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
	active: "default",
	failed: "destructive",
	provisioning: "secondary",
	validated: "secondary",
	draft: "secondary",
};

export function InstanceConfigTable() {
	const [rows, setRows] = useState<SavedConfig[]>([]);
	const [loading, setLoading] = useState(true);

	const load = async () => {
		try {
			const res = await fetch("/api/incus/instances", { cache: "no-store" });
			const j = await res.json();
			setRows(Array.isArray(j.data) ? j.data : []);
		} catch {
			/* ignore */
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		// eslint-disable-next-line react-hooks/set-state-in-effect
		load();
	}, []);

	return (
		<Card>
			<CardHeader className="flex-row items-center justify-between">
				<CardTitle>Saved instance configs</CardTitle>
				<Link href="/incus/provision">
					<Button size="sm">Provision project instance</Button>
				</Link>
			</CardHeader>
			<CardContent>
				{loading ? (
					<p className="text-sm text-muted-foreground">Loading…</p>
				) : rows.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						No saved configs yet. Use “Provision project instance” to create one.
					</p>
				) : (
					<div className="space-y-1">
						{rows.map((r) => (
							<div key={r.id} className="flex items-center justify-between text-sm border-b border-border py-1.5 last:border-0">
								<span className="font-mono">{r.name}</span>
								<div className="flex items-center gap-3">
									<span className="text-muted-foreground text-xs">{r.created_by ?? "—"}</span>
									<Badge variant={STATUS_VARIANT[r.status] ?? "secondary"}>{r.status}</Badge>
								</div>
							</div>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
