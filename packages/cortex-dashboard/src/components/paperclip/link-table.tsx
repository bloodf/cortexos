"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";

export interface PaperclipLinkRow {
	id: number;
	paperclip_issue_id: string;
	paperclip_run_id: string;
	paperclip_agent_id: string;
	cortex_role: string;
	nats_subject: string;
	status: "open" | "in_progress" | "done" | "failed" | "cancelled";
	cost_usd_cents: number;
	created_at: string;
	updated_at: string;
}

interface Props {
	rows: PaperclipLinkRow[];
}

function formatCost(cents: number): string {
	return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(iso: string): string {
	try {
		return new Date(iso).toLocaleString();
	} catch {
		return iso;
	}
}

function statusVariant(
	status: PaperclipLinkRow["status"],
): "default" | "secondary" | "outline" | "destructive" {
	switch (status) {
		case "done":
			return "default";
		case "in_progress":
		case "open":
			return "secondary";
		case "failed":
		case "cancelled":
			return "destructive";
		default:
			return "outline";
	}
}

export function PaperclipLinkTable({ rows }: Props) {
	if (rows.length === 0) {
		return (
			<div className="rounded-xl border border-border bg-background/40 p-6 text-sm text-muted-foreground">
				No Paperclip ticket links yet. Once the bridge starts forwarding tasks,
				they will appear here.
			</div>
		);
	}

	return (
		<div className="overflow-x-auto rounded-xl border border-border bg-background/40">
			<table className="w-full text-sm">
				<thead className="border-b border-border bg-background/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
					<tr>
						<th className="px-3 py-2">Issue</th>
						<th className="px-3 py-2">Role</th>
						<th className="px-3 py-2">Status</th>
						<th className="px-3 py-2 text-right">Cost</th>
						<th className="px-3 py-2">Updated</th>
					</tr>
				</thead>
				<tbody>
					{rows.map((row) => (
						<tr
							key={row.id}
							className="border-b border-border/50 last:border-0 hover:bg-background/30"
						>
							<td className="px-3 py-2 font-mono text-xs text-foreground/90">
								{row.paperclip_issue_id}
							</td>
							<td className="px-3 py-2 text-foreground/90">{row.cortex_role}</td>
							<td className="px-3 py-2">
								<Badge variant={statusVariant(row.status)} className="text-[10px]">
									{row.status}
								</Badge>
							</td>
							<td className="px-3 py-2 text-right font-mono text-xs text-foreground/90">
								{formatCost(row.cost_usd_cents)}
							</td>
							<td className="px-3 py-2 text-xs text-muted-foreground">
								{formatDate(row.updated_at)}
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
