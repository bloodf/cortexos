import { useQuery } from "@tanstack/react-query";
import { Boxes, Plug } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api/client";
import type { McpServerEntry } from "@/lib/api/client";

function commandText(server: McpServerEntry): string {
  if (server.url) return server.url;
  return [server.command, ...(server.args ?? [])].filter(Boolean).join(" ");
}

export default function McpsPage() {
  const {
    data: servers = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["mcp", "servers"],
    queryFn: api.mcpServers,
  });

  return (
    <div className="space-y-5">
      <PageHeader
        icon={<Plug className="size-5" />}
        title="MCP Servers"
        description="AI harness MCP declarations from Claude and Cursor configs."
      />

      {isLoading ? (
        <Card className="p-6 elev-1">
          <EmptyState title="Loading MCP servers…" />
        </Card>
      ) : isError ? (
        <Card className="p-6 elev-1">
          <EmptyState
            icon={<Boxes className="size-8" />}
            title="Couldn't load MCP servers"
            description="The request failed — it will retry automatically."
          />
        </Card>
      ) : servers.length === 0 ? (
        <Card className="p-6 elev-1">
          <EmptyState
            icon={<Boxes className="size-8" />}
            title="No MCP servers"
            description="No MCP server declarations were found in the configured harness home."
          />
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {servers.map((server) => (
            <Card key={server.name} className="p-4 elev-1 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-semibold truncate">{server.name}</h3>
                  <p className="text-xs text-muted-foreground">{server.sources.length} source(s)</p>
                </div>
                <Badge variant="outline" className="uppercase text-[10px]">
                  {server.transport}
                </Badge>
              </div>

              <pre className="rounded-md bg-muted/50 p-2 text-xs overflow-auto whitespace-pre-wrap break-words font-mono">
                {commandText(server) || "(no command/url)"}
              </pre>

              <div className="flex flex-wrap gap-1">
                {server.sources.map((source) => (
                  <Badge key={source} variant="secondary" className="text-[10px]">
                    {source}
                  </Badge>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
