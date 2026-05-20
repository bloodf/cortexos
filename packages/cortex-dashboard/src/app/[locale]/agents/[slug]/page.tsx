import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { scanAgents } from "@/lib/agents/scanner";
import { Link } from "@/i18n/routing";
import { AgentFileViewer } from "@/components/agents/agent-file-viewer";

interface Props { params: Promise<{ slug: string }> }

export default async function AgentDetailPage({ params }: Props) {
	const { slug } = await params;
	const groups = await scanAgents();
	const found = groups.flatMap((group) => group.agents.map((agent) => ({ agent, project: group.project }))).find((entry) => entry.agent.slug === slug);
	if (!found) notFound();
	return <div className="space-y-6"><div className="flex items-center gap-3"><Link href="/agents" className="text-muted-foreground transition-colors hover:text-foreground"><ArrowLeft className="size-5" /></Link><div><h1 className="text-2xl font-semibold">{found.agent.emoji ? `${found.agent.emoji} ` : ""}{found.agent.name}</h1><p className="mt-0.5 text-sm text-muted-foreground">{found.project} · {found.agent.model} · {found.agent.files.length} markdown files</p></div></div><AgentFileViewer slug={found.agent.slug} files={found.agent.files.map((file) => ({ name: file.name, path: file.path }))} /></div>;
}
