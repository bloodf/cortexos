import { scanAgents } from "@/lib/agents/scanner";
import { Link } from "@/i18n/routing";
import { EmptyState } from "@/components/ui/empty-state";
import { FileText } from "lucide-react";

export default async function AgentsPage() {
	const groups = await scanAgents();
	const totalAgents = groups.reduce((sum, g) => sum + g.agents.length, 0);

	if (groups.length === 0) {
		return (
			<div className="space-y-4">
				<h1 className="text-2xl font-semibold text-white/90 light:text-slate-800">
					Agents
				</h1>
				<EmptyState
					title="No agents"
					description="No Hermes profiles were found in the configured scan roots."
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
					{groups.length === 1 ? "" : "s"}
				</p>
			</div>

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
