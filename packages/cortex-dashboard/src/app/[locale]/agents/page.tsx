import { scanAgents } from "@/lib/agents/scanner";
import { Link } from "@/i18n/routing";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Bot, FileText } from "lucide-react";

export default async function AgentsPage() {
	const groups = await scanAgents();
	const totalAgents = groups.reduce((sum, g) => sum + g.agents.length, 0);

	if (groups.length === 0) {
		return (
			<div className="flex flex-col gap-6 p-6">
				<PageHeader
					title="Agents"
					description="Hermes agent profiles discovered across your projects."
					icon={<Bot />}
				/>
				<EmptyState
					icon={<Bot />}
					title="No agents"
					description="No Hermes profiles were found in the configured scan roots."
				/>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-8 p-6">
			<PageHeader
				title="Agents"
				description={`${totalAgents} agent${totalAgents === 1 ? "" : "s"} across ${groups.length} project${groups.length === 1 ? "" : "s"}.`}
				icon={<Bot />}
			/>

			{groups.map((group) => (
				<section key={group.project} className="flex flex-col gap-3">
					<h2 className="text-lg font-semibold capitalize text-foreground">
						{group.project}
						<span className="ml-2 text-sm font-normal text-muted-foreground">
							({group.agents.length})
						</span>
					</h2>
					<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
						{group.agents.map((agent) => (
							<Link
								key={`${group.project}-${agent.slug}`}
								href={`/agents/${agent.slug}`}
								className="block"
							>
								<Card size="sm" className="gap-3 p-4 transition-colors hover:bg-muted/50">
									<div className="flex items-start justify-between gap-2">
										<div className="min-w-0">
											<div className="truncate font-medium text-foreground">
												{agent.emoji ? `${agent.emoji} ` : ""}{agent.name}
											</div>
											<div className="truncate font-mono text-xs text-muted-foreground">
												{agent.slug}
											</div>
										</div>
									</div>
									<dl className="space-y-1 text-xs">
										<div className="flex justify-between gap-2">
											<dt className="text-muted-foreground">Model</dt>
											<dd className="truncate font-mono text-foreground">
												{agent.model}
											</dd>
										</div>
										<div className="flex justify-between gap-2">
											<dt className="text-muted-foreground">Files</dt>
											<dd className="flex items-center gap-1 text-foreground">
												<FileText className="size-3" />
												{agent.files.length}
											</dd>
										</div>
									</dl>
								</Card>
							</Link>
						))}
					</div>
				</section>
			))}
		</div>
	);
}

export const dynamic = "force-dynamic";
