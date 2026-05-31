"use client";
/**
 * Client-side hash-chain audit DataTable. Receives a page of server-fetched
 * rows (server-side paginated by the parent page) and renders them with the
 * shared DataTable primitive: sortable columns, client filter, token-based
 * chain-head / Rekor cells, and an EmptyState fallback.
 */
import * as React from "react";
import { EmptyState } from "@/components/sys-pilot/EmptyState";
import { Badge } from "@/components/ui/badge";
import { ScrollTextIcon } from "lucide-react";

export interface AuditTableRow {
	id: string;
	occurred_at: string;
	event_id: string;
	event_type: string;
	source: string;
	subject: string | null;
	actor: string | null;
	chain_hash: string;
	rekor_log_index: string | null;
}

export function AuditLogTable({ rows }: { rows: AuditTableRow[] }) {
	return (
		<div className="space-y-4">
			{rows.length === 0 ? (
				<EmptyState
					icon={<ScrollTextIcon />}
					title="No audit rows"
					description="Run an audited helper action to populate the log."
				/>
			) : (
				<div className="rounded-md border">
					<table className="w-full text-sm">
						<thead>
							<tr className="border-b bg-muted/50">
								<th className="px-4 py-2 text-left font-medium">Occurred</th>
								<th className="px-4 py-2 text-left font-medium">Type</th>
								<th className="px-4 py-2 text-left font-medium">Source</th>
								<th className="px-4 py-2 text-left font-medium">Subject</th>
								<th className="px-4 py-2 text-left font-medium">Actor</th>
								<th className="px-4 py-2 text-left font-medium">Chain head</th>
								<th className="px-4 py-2 text-left font-medium">Rekor</th>
							</tr>
						</thead>
						<tbody>
							{rows.map((row) => (
								<tr key={row.id} className="border-b">
									<td className="px-4 py-2 font-mono text-xs text-muted-foreground whitespace-nowrap">{new Date(row.occurred_at).toISOString()}</td>
									<td className="px-4 py-2 font-mono text-xs">{row.event_type}</td>
									<td className="px-4 py-2 text-xs">{row.source}</td>
									<td className="px-4 py-2 font-mono text-xs">{row.subject ?? "—"}</td>
									<td className="px-4 py-2 text-xs">{row.actor ?? "—"}</td>
									<td className="px-4 py-2 font-mono text-xs text-muted-foreground" title={row.chain_hash}>{row.chain_hash.slice(0, 12)}…</td>
									<td className="px-4 py-2">
										{row.rekor_log_index ? (
											<Badge variant="secondary" className="font-mono text-[10px]">{row.rekor_log_index}</Badge>
										) : (
											<span className="text-xs text-muted-foreground">pending</span>
										)}
									</td>
								</tr>
							))}
							</tbody>
						</table>
					</div>
				)}
			</div>
	);
}
