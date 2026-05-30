"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import useSWR from "swr";
import { Check, ShieldPlus, Trash2, X } from "lucide-react";
import { DataTable } from "@/components/ui/data-table";
import { IconButton } from "@/components/ui/icon-button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

interface ReviewRow {
	id: string;
	account_slug: string;
	message_uid: string;
	message_id: string | null;
	from_hash: string;
	domain_hash: string;
	subject_hash: string;
	body_hash: string;
	summary: string;
	model_verdict: string;
	model_confidence: string;
	owner_decision: string | null;
	approver: string | null;
	requested_at: string;
	resolved_at: string | null;
	processed_action: string | null;
	queued_decision: string | null;
	queued_status: string | null;
	queued_error: string | null;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());
const shortHash = (value: string) => `${value.slice(0, 10)}…`;

function DecisionBadge({ value }: { value: string }) {
	const variant = value === "kept" || value === "keep" || value === "allow_sender" ? "default" : "destructive";
	return <Badge variant={variant} className="text-[10px]">{value}</Badge>;
}

export function MailGuardianReviewsPanel() {
	const [openOnly, setOpenOnly] = React.useState(true);
	const [error, setError] = React.useState<string | null>(null);
	const [running, setRunning] = React.useState<string | null>(null);
	const { data, mutate } = useSWR<{ reviews: ReviewRow[] }>(`/api/mail-guardian/reviews?open=${openOnly}`, fetcher, { refreshInterval: 5000 });
	const rows = data?.reviews ?? [];

	async function decide(row: ReviewRow, decision: "spam" | "keep" | "block_sender" | "allow_sender") {
		setRunning(`${row.id}:${decision}`);
		setError(null);
		const res = await fetch("/api/mail-guardian/reviews", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ id: Number(row.id), decision }),
		});
		setRunning(null);
		if (!res.ok) {
			const body = await res.json().catch(() => ({})) as { error?: string };
			setError(body.error ?? `HTTP ${res.status}`);
			return;
		}
		await mutate((current) => openOnly
			? { reviews: (current?.reviews ?? []).filter((item) => item.id !== row.id) }
			: {
				reviews: (current?.reviews ?? []).map((item) => item.id === row.id
					? { ...item, queued_decision: decision, queued_status: "pending", queued_error: null }
					: item),
			}, { revalidate: false });
		await mutate();
	}

	const columns = React.useMemo<ColumnDef<ReviewRow>[]>(() => [
		{ accessorKey: "id", header: "ID", cell: ({ row }) => <span className="font-mono text-xs">#{row.original.id}</span> },
		{ accessorKey: "account_slug", header: "Account", cell: ({ row }) => <span className="font-mono text-xs">{row.original.account_slug}</span> },
		{ accessorKey: "requested_at", header: "Requested", cell: ({ row }) => new Date(row.original.requested_at).toLocaleString() },
		{ accessorKey: "model_verdict", header: "Model", cell: ({ row }) => <div className="flex items-center gap-2"><DecisionBadge value={row.original.model_verdict} /><span className="font-mono text-xs text-muted-foreground">{Number(row.original.model_confidence).toFixed(2)}</span></div> },
		{ accessorKey: "summary", header: "Summary", cell: ({ row }) => <span className="block max-w-[360px] truncate text-xs" title={row.original.summary}>{row.original.summary || "—"}</span> },
		{ id: "hashes", header: "Hashes", cell: ({ row }) => <div className="space-y-1 font-mono text-[10px] text-muted-foreground"><div>from {shortHash(row.original.from_hash)}</div><div>subj {shortHash(row.original.subject_hash)}</div></div> },
		{ id: "status", header: "Status", cell: ({ row }) => {
			if (row.original.resolved_at) return <DecisionBadge value={row.original.owner_decision ?? "resolved"} />;
			if (row.original.queued_status === "pending" || row.original.queued_status === "processing") return <Badge variant="outline" className="text-[10px]">{row.original.queued_decision} queued</Badge>;
			if (row.original.queued_status === "failed") return <span title={row.original.queued_error ?? undefined}><Badge variant="destructive" className="text-[10px]">failed</Badge></span>;
			return <Badge variant="outline" className="text-[10px]">open</Badge>;
		} },
		{ id: "actions", header: "", cell: ({ row }) => row.original.resolved_at || row.original.queued_status === "pending" || row.original.queued_status === "processing" ? null : <div className="flex justify-end gap-1"><IconButton tooltip="Spam → trash" variant="danger" loading={running === `${row.original.id}:spam`} onClick={() => decide(row.original, "spam")}><Trash2 className="size-4" /></IconButton><IconButton tooltip="Keep" variant="primary" loading={running === `${row.original.id}:keep`} onClick={() => decide(row.original, "keep")}><Check className="size-4" /></IconButton><IconButton tooltip="Block sender" variant="danger" loading={running === `${row.original.id}:block_sender`} onClick={() => decide(row.original, "block_sender")}><X className="size-4" /></IconButton><IconButton tooltip="Allow sender" variant="ghost" loading={running === `${row.original.id}:allow_sender`} onClick={() => decide(row.original, "allow_sender")}><ShieldPlus className="size-4" /></IconButton></div> },
	// eslint-disable-next-line react-hooks/exhaustive-deps
	], [openOnly, running]);

	return (
		<div className="space-y-3">
			<div className="flex items-center justify-between gap-2">
				<p className="text-sm text-muted-foreground">Raw subjects/bodies stay out of Postgres; rows show redacted summaries and hashes only.</p>
				<Button type="button" variant="outline" size="sm" onClick={() => setOpenOnly((value) => !value)}>{openOnly ? "Show all" : "Show open"}</Button>
			</div>
			{error && <p className="text-sm text-destructive">{error}</p>}
			{rows.length === 0 ? <EmptyState title="No mail reviews" description={openOnly ? "No open reviews are waiting." : "No reviews recorded."} /> : <DataTable columns={columns} data={rows} />}
		</div>
	);
}
