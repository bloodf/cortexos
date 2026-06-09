import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { FileCode, Eye, EyeOff, Copy } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/mocks/api";

export function AdminEnvPage() {
  const { data = [] } = useQuery({ queryKey: ["envFiles"], queryFn: api.envFiles });
  const [selected, setSelected] = useState(0);
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const file = data[selected];

  return (
    <div className="space-y-5">
      <PageHeader title="Env Browser" description="Inspect and rotate environment secrets for managed services." />
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
        <Card className="p-2 h-fit">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground px-2 pb-2">Env files</div>
          {data.map((f, i) => (
            <button
              key={f.path}
              onClick={() => setSelected(i)}
              className={`w-full text-left rounded-md px-2 py-1.5 flex items-center gap-2 text-sm transition-colors ${i === selected ? "bg-accent text-accent-foreground" : "hover:bg-muted/50"}`}
            >
              <FileCode className="size-3.5 shrink-0" />
              <span className="truncate font-mono text-xs">{f.path.split("/").pop()}</span>
            </button>
          ))}
        </Card>
        <Card className="p-4">
          {file && (
            <>
              <div className="flex items-center justify-between mb-3">
                <code className="text-xs text-muted-foreground">{file.path}</code>
                <span className="text-xs text-muted-foreground">{file.keys.length} keys</span>
              </div>
              <div className="space-y-2">
                {file.keys.map((k) => {
                  const v = "•".repeat(24);
                  return (
                    <div key={k} className="grid grid-cols-[200px_1fr_auto] gap-2 items-center">
                      <code className="text-xs font-semibold">{k}</code>
                      <Input value={reveal[k] ? `mock-${k.toLowerCase()}-value-${Math.random().toString(36).slice(2, 10)}` : v} readOnly className="h-8 font-mono text-xs" />
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setReveal((s) => ({ ...s, [k]: !s[k] }))}>
                          {reveal[k] ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => toast.success(`Copied ${k}`)}><Copy className="size-3.5" /></Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
