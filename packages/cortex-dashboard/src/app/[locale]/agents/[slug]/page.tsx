import { scanAgents } from "@/lib/agents/scanner";
import { Link } from "@/i18n/routing";
import { ArrowLeft } from "lucide-react";
import { AgentFileViewer } from "@/components/agents/agent-file-viewer";
import { PageHeader } from "@/components/ui/page-header";
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
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title={`${foundAgent.emoji ? `${foundAgent.emoji} ` : ""}${foundAgent.name}`}
        description={`${foundProject} · ${foundAgent.model} · ${foundAgent.files.length} files`}
        icon={
          <Link
            href="/agents"
            aria-label="Back to agents"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-5" />
          </Link>
        }
      />

      <AgentFileViewer slug={slug} files={filesForClient} />
    </div>
  );
}
