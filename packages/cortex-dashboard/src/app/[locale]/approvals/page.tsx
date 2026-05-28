/**
 * V12 — Pending approvals queue.
 *
 * Lists rows from `pending_approvals`. Each row exposes an approve / deny form
 * that calls the `decideApproval` server action.
 */
import { EmptyState } from "@/components/ui/empty-state";
import { decideApprovalForm, loadPendingApprovals } from "./actions";

export const dynamic = "force-dynamic";

function formatRelative(iso: string): string {
	const t = new Date(iso).getTime();
	if (!Number.isFinite(t)) return iso;
	const seconds = Math.max(0, Math.floor((Date.now() - t) / 1000));
	if (seconds < 60) return `${seconds}s ago`;
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	return `${days}d ago`;
}

export default async function ApprovalsPage() {
	const { rows, warning, error } = await loadPendingApprovals();

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-semibold text-white/90 light:text-slate-800">
					Pending approvals
				</h1>
				<p className="text-sm text-muted-foreground mt-1">
					Destructive operations paused on{" "}
					<code className="font-mono text-xs">cortex.signals.&lt;runId&gt;.&lt;name&gt;</code>.
					Approve or deny to unblock the consumer.
				</p>
			</div>

			{warning && (
				<div className="rounded-md border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-200">
					{warning}
				</div>
			)}
			{error && (
				<div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
					{error}
				</div>
			)}

			{rows.length === 0 ? (
				<EmptyState
					title="No pending approvals"
					description="Approvals will appear here when a role with approvalRequired: true emits a destructive op."
				/>
			) : (
				<ul className="space-y-3">
					{rows.map((row) => (
						<li
							key={row.id}
							className="rounded-xl border border-border bg-background/40 p-4"
						>
							<div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
								<div className="space-y-1">
									<div className="text-sm font-mono text-foreground">
										{row.run_id}
										<span className="ml-2 text-xs text-muted-foreground">
											signal={row.signal_name}
										</span>
									</div>
									<div className="text-xs text-muted-foreground">
										{row.role ? `role=${row.role} ` : ""}
										{row.issue_id ? `issue=${row.issue_id} ` : ""}
										requested {formatRelative(row.requested_at)}
										{row.timeout_at ? ` · timeout ${row.timeout_at}` : ""}
									</div>
									{row.reason && (
										<div className="text-xs text-muted-foreground">
											reason: {row.reason}
										</div>
									)}
								</div>
								<div className="flex gap-2">
									<form action={decideApprovalForm}>
										<input
											type="hidden"
											name="runId"
											value={row.run_id}
										/>
										<input
											type="hidden"
											name="signalName"
											value={row.signal_name}
										/>
										<input
											type="hidden"
											name="decision"
											value="approve"
										/>
										<button
											type="submit"
											className="rounded-md bg-emerald-500/20 px-3 py-1.5 text-xs font-medium text-emerald-200 hover:bg-emerald-500/30"
										>
											Approve
										</button>
									</form>
									<form action={decideApprovalForm}>
										<input
											type="hidden"
											name="runId"
											value={row.run_id}
										/>
										<input
											type="hidden"
											name="signalName"
											value={row.signal_name}
										/>
										<input
											type="hidden"
											name="decision"
											value="deny"
										/>
										<button
											type="submit"
											className="rounded-md bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-200 hover:bg-red-500/30"
										>
											Deny
										</button>
									</form>
								</div>
							</div>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
