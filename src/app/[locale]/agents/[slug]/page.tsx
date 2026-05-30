import { scanAgents } from "@/lib/agents/scanner";
import { Link } from "@/i18n/routing";
import { ArrowLeft } from "lucide-react";
import { AgentFileViewer } from "@/components/agents/agent-file-viewer";
import { notFound } from "next/navigation";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function AgentDetailPage({ params }: Props) {
  const { slug } = await params;
  const groups = await scanAgents();

  let foundAgent = null;
  let foundProject = "";
  for (const group of groups) {
    const match = group.agents.find((a) => a.slug === slug);
    if (match) {
      foundAgent = match;
      foundProject = group.project;
      break;
    }
  }

  if (!foundAgent) {
    notFound();
  }

  const filesForClient = foundAgent.files.map((f) => ({
    name: f.name,
    path: f.path,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/agents"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-white/90 light:text-slate-800">
            {foundAgent.name}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {foundProject} &middot; {foundAgent.model} &middot; {foundAgent.files.length} files
          </p>
        </div>
      </div>

      <AgentFileViewer slug={slug} files={filesForClient} />
    </div>
  );
}
