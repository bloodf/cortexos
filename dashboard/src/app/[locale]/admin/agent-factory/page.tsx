// STUB for v1.0. Wizard wires fully in Phase 4 once /api/ai/chat is non-stub.
// TODO: replace right-column "coming soon" with chat-driven wizard.

import { listAgentFactories } from "@/lib/db/agent-factories";
import { EmptyState } from "@/components/ui/empty-state";

export default async function AdminAgentFactoryPage() {
	const factories = await listAgentFactories({});

	return (
		<div className="space-y-4">
			<h1 className="text-2xl font-semibold">Admin · Agent Factory</h1>
			<div className="grid gap-4 md:grid-cols-[280px_1fr]">
				<aside className="rounded-lg border border-border p-3">
					<h2 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Factories</h2>
					{factories.length === 0 ? (
						<p className="text-xs text-muted-foreground">No factories yet.</p>
					) : (
						<ul className="space-y-1">
							{factories.map((f) => (
								<li key={f.id} className="rounded px-2 py-1 text-sm hover:bg-muted">
									<span className="font-medium">{f.name}</span>
									<span className="ml-2 text-xs text-muted-foreground">({f.kind})</span>
								</li>
							))}
						</ul>
					)}
				</aside>
				<div>
					<EmptyState
						title="Wizard coming soon"
						description="The factory wizard runs through the Cortex chat panel on the right. Open it from the topbar to start."
					/>
				</div>
			</div>
		</div>
	);
}

export const dynamic = "force-dynamic";
