"use client";

import { useMemo, useState } from "react";
import { FileText, FolderTree } from "lucide-react";
import { PageHeader } from "@/components/sys-pilot/PageHeader";
import { TechIcon } from "@/components/sys-pilot/TechIcon";
import { CodeBlock } from "@/components/sys-pilot/CodeBlock";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

export default function AgentsPage() {
  const t = useTranslations();
  const { data: agents = [] } = useQuery({ queryKey: ["agents"], queryFn: api.agents });
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [activeFile, setActiveFile] = useState<string | null>(null);

  const active = useMemo(() => agents.find((a) => a.slug === activeSlug) ?? agents[0], [agents, activeSlug]);
  const file = useMemo(() => active?.files.find((f: any) => f.path === activeFile) ?? active?.files[0], [active, activeFile]);

  return (
    <div className="space-y-5">
      <PageHeader title="Agents" description="Inspect agent definitions, prompts and policies." />
      <div className="grid gap-3 lg:grid-cols-[260px_240px_1fr] min-h-[60vh]">
        <Card className="elev-1 p-2 space-y-1">
          {agents.map((a) => (
            <button key={a.slug} onClick={() => { setActiveSlug(a.slug); setActiveFile(null); }} className={cn("w-full text-left rounded-md px-2 py-2 flex items-center gap-2 hover:bg-muted/40", active?.slug === a.slug && "bg-accent text-accent-foreground")}>
              <TechIcon slug={a.slug} name={a.name} size={28} />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{a.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">{a.description}</p>
              </div>
            </button>
          ))}
        </Card>
        <Card className="elev-1 p-2 space-y-0.5">
          <div className="flex items-center gap-2 px-2 py-1 text-xs uppercase tracking-wider text-muted-foreground"><FolderTree className="size-3" />Files</div>
          {active?.files.map((f: any) => (
            <button key={f.path} onClick={() => setActiveFile(f.path)} className={cn("w-full text-left rounded px-2 py-1.5 text-sm flex items-center gap-2 hover:bg-muted/40 font-mono", file?.path === f.path && "bg-accent text-accent-foreground")}>
              <FileText className="size-3.5 text-muted-foreground" />
              <span className="truncate">{f.path}</span>
            </button>
          ))}
        </Card>
        <Card className="elev-1 p-0 overflow-hidden">
          {file && <CodeBlock language={file.language} code={file.content} className="border-0 rounded-none h-full" />}
        </Card>
      </div>
    </div>
  );
}
