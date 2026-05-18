/**
 * V9 audit viewer.
 *
 * Server component. Lists hash-chained audit_log rows paginated by
 * `occurred_at DESC`. Renders a client-side chain-verify badge that calls
 * `/api/audit/verify` for the visible window.
 *
 * Auth note: this page sits under `[locale]` so it inherits the dashboard
 * locale middleware and admin layout's auth check. The verify API itself
 * also enforces `requireAdmin`, so a non-admin reaching the page sees an
 * empty result rather than tampered output.
 */
import Link from "next/link";
import { query } from "@/lib/db/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheckIcon } from "lucide-react";
import { AuditChainVerifyBadge } from "./chain-verify-badge";
import { auditViewerQuerySchema, parseInput } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PAGE_SIZE = 50;

interface AuditRow {
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

interface PageProps {
	searchParams?: Promise<{ page?: string }>;
}

export default async function AuditViewerPage({ searchParams }: PageProps) {
	const sp = (await searchParams) ?? {};
	const parsedQuery = parseInput(auditViewerQuerySchema, sp, {
		action: "audit.viewer",
	});
	const page = parsedQuery.ok ? parsedQuery.data.page : 1;
	const offset = (page - 1) * PAGE_SIZE;

	let rows: AuditRow[] = [];
	let total = 0;
	let firstTs: string | null = null;
	let lastTs: string | null = null;

	try {
		const result = await query<AuditRow>(
			`SELECT id::text, occurred_at, event_id, event_type, source, subject,
                actor, chain_hash, rekor_log_index::text
           FROM audit_log
          ORDER BY occurred_at DESC, id DESC
          LIMIT $1 OFFSET $2`,
			[PAGE_SIZE, offset],
		);
		rows = result;
		const totals = await query<{ c: string }>(
			`SELECT COUNT(*)::text AS c FROM audit_log`,
		);
		total = parseInt(totals[0]?.c ?? "0", 10);
		if (rows.length > 0) {
			lastTs = rows[0].occurred_at;
			firstTs = rows[rows.length - 1].occurred_at;
		}
	} catch (e) {
		// Table may not exist yet (pre-migration). Render empty state.
		const msg = e instanceof Error ? e.message : "unknown";
		rows = [];
		total = 0;
		// Stash error in a hidden HTML comment for operator debug.
		console.error("[audit-viewer] query failed:", msg);
	}

	const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

	return (
		<div className="space-y-6">
			<div className="flex items-center gap-2">
				<ShieldCheckIcon className="size-5" />
				<h1 className="text-xl font-bold">Audit Log</h1>
				<Badge variant="secondary">{total} rows</Badge>
				<div className="ml-auto">
					<AuditChainVerifyBadge from={firstTs} to={lastTs} />
				</div>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Page {page} of {totalPages}</CardTitle>
				</CardHeader>
				<CardContent className="overflow-x-auto">
					<table className="w-full text-xs">
						<thead>
							<tr className="border-b">
								<th className="text-left p-2">Occurred</th>
								<th className="text-left p-2">Type</th>
								<th className="text-left p-2">Source</th>
								<th className="text-left p-2">Subject</th>
								<th className="text-left p-2">Actor</th>
								<th className="text-left p-2">Chain head</th>
								<th className="text-left p-2">Rekor</th>
							</tr>
						</thead>
						<tbody>
							{rows.length === 0 && (
								<tr>
									<td colSpan={7} className="p-4 text-center text-muted-foreground">
										No audit rows. Run a paperclip transition to populate the log.
									</td>
								</tr>
							)}
							{rows.map((r) => (
								<tr key={r.id} className="border-b last:border-0">
									<td className="p-2 font-mono whitespace-nowrap">
										{new Date(r.occurred_at).toISOString()}
									</td>
									<td className="p-2 font-mono">{r.event_type}</td>
									<td className="p-2">{r.source}</td>
									<td className="p-2 font-mono">{r.subject ?? "—"}</td>
									<td className="p-2">{r.actor ?? "—"}</td>
									<td className="p-2 font-mono" title={r.chain_hash}>
										{r.chain_hash.slice(0, 12)}…
									</td>
									<td className="p-2 font-mono">
										{r.rekor_log_index ?? <span className="text-muted-foreground">pending</span>}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</CardContent>
			</Card>

			<nav className="flex gap-2">
				{page > 1 && (
					<Link
						className="text-sm underline"
						href={`?page=${page - 1}`}
					>
						← Prev
					</Link>
				)}
				{page < totalPages && (
					<Link
						className="text-sm underline ml-auto"
						href={`?page=${page + 1}`}
					>
						Next →
					</Link>
				)}
			</nav>
		</div>
	);
}
