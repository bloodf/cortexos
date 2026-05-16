import { scanAgents } from "@/lib/agents/scanner";
import { listAgentFactories } from "@/lib/db/agent-factories";
import { Link } from "@/i18n/routing";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { FileText, Factory } from "lucide-react";

export default async function AgentsPage() {
	const [groups, factories] = await Promise.all([
		scanAgents(),
		listAgentFactories({}).catch(() => []),
	]);
	const totalAgents = groups.reduce((sum, g) => sum + g.agents.length, 0);

	if (groups.length === 0 && factories.length === 0) {
		return (
			<div className="space-y-4">
				<h1 className="text-2xl font-semibold text-white/90 light:text-slate-800">
					Agents
				</h1>
				<EmptyState
					title="No agents or factories"
					description="No agents found on this host and no factories registered yet. Use Admin · Agent Factory to register one."
				/>
			</div>
		);
	}

	return (
		<div className="space-y-8">
			<div>
				<h1 className="text-2xl font-semibold text-white/90 light:text-slate-800">
					Agents
				</h1>
				<p className="text-sm text-muted-foreground mt-1">
					{totalAgents} agent{totalAgents === 1 ? "" : "s"} across {groups.length} project
					{groups.length === 1 ? "" : "s"} · {factories.length} factor
					{factories.length === 1 ? "y" : "ies"}
				</p>
			</div>

			{factories.length > 0 && (
				<section className="space-y-3">
					<h2 className="flex items-center gap-2 text-lg font-semibold capitalize text-foreground">
						<Factory className="size-4" />
						Factories
						<span className="text-sm font-normal text-muted-foreground">
							({factories.length})
						</span>
					</h2>
					<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
						{factories.map((f) => (
							<div
								key={f.id}
								className="rounded-xl border border-border bg-background/40 p-4"
							>
								<div className="flex items-start justify-between gap-2">
									<div className="min-w-0">
										<div className="font-medium text-foreground truncate">{f.name}</div>
										<div className="text-xs text-muted-foreground truncate font-mono">
											{f.slug}
										</div>
									</div>
									<Badge variant="outline" className="text-[10px]">
										{f.kind}
									</Badge>
								</div>
								<dl className="mt-3 space-y-1 text-xs">
									<div className="flex justify-between gap-2">
										<dt className="text-muted-foreground">Schema</dt>
										<dd className="text-foreground/90 font-mono">v{f.schema_version}</dd>
									</div>
									{f.created_by && (
										<div className="flex justify-between gap-2">
											<dt className="text-muted-foreground">By</dt>
											<dd className="text-foreground/90 truncate font-mono">
												{f.created_by}
											</dd>
										</div>
									)}
								</dl>
							</div>
						))}
					</div>
				</section>
			)}

			{groups.map((group) => (
				<section key={group.project} className="space-y-3">
					<h2 className="text-lg font-semibold capitalize text-foreground">
						{group.project}
						<span className="ml-2 text-sm font-normal text-muted-foreground">
							({group.agents.length})
						</span>
					</h2>
					<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
						{group.agents.map((agent) => (
							<Link
								key={`${group.project}-${agent.slug}`}
								href={`/agents/${agent.slug}`}
								className="rounded-xl border border-border bg-background/40 p-4 hover:bg-background/60 transition-colors block"
							>
								<div className="flex items-start justify-between gap-2">
									<div className="min-w-0">
										<div className="font-medium text-foreground truncate">
											{agent.emoji ? `${agent.emoji} ` : ""}{agent.name}
										</div>
										<div className="text-xs text-muted-foreground truncate font-mono">
											{agent.slug}
										</div>
									</div>
								</div>
								<dl className="mt-3 space-y-1 text-xs">
									<div className="flex justify-between gap-2">
										<dt className="text-muted-foreground">Model</dt>
										<dd className="text-foreground/90 truncate font-mono">
											{agent.model}
										</dd>
									</div>
									<div className="flex justify-between gap-2">
										<dt className="text-muted-foreground">Files</dt>
										<dd className="text-foreground/90 flex items-center gap-1">
											<FileText className="w-3 h-3" />
											{agent.files.length}
										</dd>
									</div>
								</dl>
							</Link>
						))}
					</div>
				</section>
			))}
		</div>
	);
}

export const dynamic = "force-dynamic";
