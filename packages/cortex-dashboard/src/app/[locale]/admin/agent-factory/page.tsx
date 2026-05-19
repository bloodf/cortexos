
import { listAgentFactories } from "@/lib/db/agent-factories";

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
				<div className="rounded-lg border border-border p-4">
					<h2 className="text-lg font-semibold">Installed factory templates</h2>
					<p className="mt-1 text-sm text-muted-foreground">
						These records are hydrated from the generic templates installed by the Agent Factory spoke. Use the API to add, update, or delete custom factories; the dashboard keeps the registry visible so operators can confirm what is available on this host.
					</p>
					<div className="mt-4 grid gap-3 md:grid-cols-2">
						{factories.map((f) => (
							<div key={f.id} className="rounded-md border border-border p-3">
								<div className="flex items-center justify-between gap-2">
									<div className="font-medium">{f.name}</div>
									<div className="rounded bg-muted px-2 py-0.5 text-xs uppercase text-muted-foreground">
										{f.kind}
									</div>
								</div>
								<div className="mt-2 font-mono text-xs text-muted-foreground">{f.slug}</div>
								{"template" in f.definition && typeof f.definition.template === "string" ? (
									<div className="mt-1 font-mono text-xs text-muted-foreground">
										{f.definition.template}
									</div>
								) : null}
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}

export const dynamic = "force-dynamic";
