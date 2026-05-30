/**
 * V12 — Pending approvals queue.
 *
 * Lists rows from `pending_approvals`. Each row exposes an approve / deny form
 * that calls the `decideApproval` server action.
 */
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { CheckIcon, ShieldQuestionIcon, XIcon } from "lucide-react";
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
		<div className="flex flex-col gap-6 p-6">
			<PageHeader
				title="Pending approvals"
				description={
					<>
						Destructive operations paused on{" "}
						<code className="font-mono text-xs">cortex.signals.&lt;runId&gt;.&lt;name&gt;</code>.
						Approve or deny to unblock the consumer.
					</>
				}
				icon={<ShieldQuestionIcon />}
			/>

			{warning && (
				<div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
					{warning}
				</div>
			)}
			{error && (
				<div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
					{error}
				</div>
			)}

			{rows.length === 0 ? (
				<EmptyState
					icon={<ShieldQuestionIcon />}
					title="No pending approvals"
					description="Approvals will appear here when a role with approvalRequired: true emits a destructive op."
				/>
			) : (
				<ul className="space-y-3">
					{rows.map((row) => (
						<li key={row.id}>
							<Card>
								<CardContent className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
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
											<input type="hidden" name="runId" value={row.run_id} />
											<input
												type="hidden"
												name="signalName"
												value={row.signal_name}
											/>
											<input type="hidden" name="decision" value="approve" />
											<button
												type="submit"
												className="inline-flex items-center gap-1 rounded-md bg-success/15 px-3 py-1.5 text-xs font-medium text-success hover:bg-success/25"
											>
												<CheckIcon className="size-3.5" />
												Approve
											</button>
										</form>
										<form action={decideApprovalForm}>
											<input type="hidden" name="runId" value={row.run_id} />
											<input
												type="hidden"
												name="signalName"
												value={row.signal_name}
											/>
											<input type="hidden" name="decision" value="deny" />
											<button
												type="submit"
												className="inline-flex items-center gap-1 rounded-md bg-destructive/15 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/25"
											>
												<XIcon className="size-3.5" />
												Deny
											</button>
										</form>
									</div>
								</CardContent>
							</Card>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
