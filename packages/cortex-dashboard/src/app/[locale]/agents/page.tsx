import { scanAgents } from "@/lib/agents/scanner";
import { Link } from "@/i18n/routing";
import { EmptyState } from "@/components/ui/empty-state";
import { FileText } from "lucide-react";

export default async function AgentsPage() {
	const groups = await scanAgents().catch(() => []);
	const agents = groups.flatMap((group) => group.agents.map((agent) => ({ ...agent, project: group.project })));
	if (agents.length === 0) return <div className="space-y-4"><h1 className="text-2xl font-semibold">Agents</h1><EmptyState title="No active Hermes profiles" description="No Hermes profiles were discovered in the CortexOS profile registry." /></div>;
	return <div className="space-y-6"><div><h1 className="text-2xl font-semibold">Agents</h1><p className="mt-1 text-sm text-muted-foreground">Active Hermes profiles and their editable markdown files.</p></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{agents.map((agent) => <Link key={agent.slug} href={`/agents/${agent.slug}`} className="block rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/40"><div className="font-medium">{agent.emoji ? `${agent.emoji} ` : ""}{agent.name}</div><div className="mt-1 truncate font-mono text-xs text-muted-foreground">{agent.slug}</div><dl className="mt-3 space-y-1 text-xs"><div className="flex justify-between gap-2"><dt className="text-muted-foreground">Project</dt><dd className="truncate">{agent.project}</dd></div><div className="flex justify-between gap-2"><dt className="text-muted-foreground">Model</dt><dd className="truncate font-mono">{agent.model}</dd></div><div className="flex justify-between gap-2"><dt className="text-muted-foreground">Files</dt><dd className="flex items-center gap-1"><FileText className="size-3" />{agent.files.length}</dd></div></dl></Link>)}</div></div>;
}

export const dynamic = "force-dynamic";
