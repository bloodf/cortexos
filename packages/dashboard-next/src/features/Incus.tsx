import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Plus, Boxes, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { DataTable, type Column } from "@/components/DataTable";
import { KeyValueList } from "@/components/KeyValueList";
import { CodeBlock } from "@/components/CodeBlock";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/mocks/api";
import { useT } from "@/hooks/useT";
import { useAuth } from "@/hooks/useAuth";
import type { IncusInstance } from "@/mocks/types";
import { bytes, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const statusColors: Record<IncusInstance["status"], string> = {
  active: "border-[var(--success)] text-[var(--success)]",
  provisioning: "border-[var(--warning)] text-[var(--warning)]",
  validated: "border-primary text-primary",
  draft: "border-muted-foreground text-muted-foreground",
  failed: "border-[var(--destructive)] text-[var(--destructive)]",
};

export function IncusPage() {
  const t = useT();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: instances = [], isLoading } = useQuery({ queryKey: ["incus"], queryFn: api.incus });
  const [active, setActive] = useState<IncusInstance | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);

  const cols: Column<IncusInstance>[] = [
    { key: "project", header: "Project", sort: (r) => r.project.name, cell: (r) => (
      <div className="min-w-0">
        <Link to="/incus/$name" params={{ name: r.name }} className="font-medium hover:underline truncate block">{r.project.name}</Link>
        <p className="text-[10px] text-muted-foreground truncate">{r.project.description}</p>
      </div>
    ) },
    { key: "name", header: "Instance", sort: (r) => r.name, cell: (r) => <code className="text-xs">{r.name}</code> },
    { key: "type", header: "Type", sort: (r) => r.type, cell: (r) => <Badge variant="outline">{r.type}</Badge> },
    { key: "image", header: "Image", cell: (r) => <code className="text-xs">{r.image}</code> },
    { key: "cpu", header: "CPU", className: "text-right tabular-nums", cell: (r) => `${r.cpu}` },
    { key: "memory", header: "Memory", className: "text-right tabular-nums", cell: (r) => bytes(r.memory * 1024 * 1024) },
    { key: "status", header: "Status", sort: (r) => r.status, cell: (r) => <Badge variant="outline" className={cn(statusColors[r.status])}>{r.status}</Badge> },
    { key: "act", header: "", className: "text-right", cell: (r) => <Button size="sm" variant="ghost" onClick={() => setActive(r)}><ChevronRight className="size-3.5" /></Button> },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        icon={<Boxes className="size-5" />}
        title={t.nav.incus}
        description="One project per Incus instance — manage system containers, VMs and the projects they host."
        actions={user?.is_admin && <Button size="sm" variant="success" onClick={() => setWizardOpen(true)}><Plus className="size-4 mr-1" />New project / instance</Button>}
      />

      <DataTable
        columns={cols}
        initialSort="project"
        server={{ queryKey: ["incus"], fetch: api.incusList }}
      />



      <Sheet open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {active && (
            <>
              <SheetHeader>
                <SheetTitle>{active.project.name}</SheetTitle>
                <p className="text-xs text-muted-foreground">{active.project.description}</p>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                <KeyValueList items={[
                  { key: "Instance", value: <code className="text-xs">{active.name}</code> },
                  { key: "Repo", value: active.project.repo_url ? <a href={active.project.repo_url} target="_blank" rel="noreferrer" className="text-primary hover:underline text-xs">{active.project.repo_url.replace("https://", "")}</a> : "—" },
                  { key: "Branch", value: <code className="text-xs">{active.project.branch}</code> },
                  { key: "Type", value: active.type },
                  { key: "Image", value: active.image },
                  { key: "Status", value: <Badge variant="outline" className={cn(statusColors[active.status])}>{active.status}</Badge> },
                  { key: "CPU", value: active.cpu },
                  { key: "Memory", value: bytes(active.memory * 1024 * 1024) },
                  { key: "Created", value: relativeTime(active.created_at) },
                ]} />
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Config</p>
                  <CodeBlock language="yaml" code={Object.entries(active.config).map(([k, v]) => `${k}: ${v}`).join("\n")} />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Devices</p>
                  <CodeBlock language="yaml" code={Object.entries(active.devices).map(([k, v]) => `${k}:\n${Object.entries(v).map(([kk, vv]) => `  ${kk}: ${vv}`).join("\n")}`).join("\n")} />
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <ProvisionWizard open={wizardOpen} onOpenChange={setWizardOpen} onCreated={(inst) => {
        qc.setQueryData<IncusInstance[]>(["incus"], (p) => [inst, ...(p ?? [])]);
        toast.success(`Provisioned ${inst.name}`);
      }} />
    </div>
  );
}

function ProvisionWizard({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (i: IncusInstance) => void }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("hermes-canary");
  const [image, setImage] = useState("ubuntu/24.04");
  const [cpu, setCpu] = useState(2);
  const [mem, setMem] = useState(4096);
  const [log, setLog] = useState<string[]>([]);
  const [done, setDone] = useState(false);

  const start = () => {
    setStep(4); setLog([]); setDone(false);
    const steps = ["Preflight: validating name…", "Preflight: checking image cache…", "incus launch ubuntu/24.04 " + name, "Applying limits.cpu=" + cpu, "Applying limits.memory=" + mem + "MiB", "Starting instance…", "Instance started"];
    steps.forEach((s, i) => setTimeout(() => {
      setLog((l) => [...l, s]);
      if (i === steps.length - 1) {
        setDone(true);
        onCreated({
          name, slug: name, status: "active", type: "container", image,
          cpu, memory: mem,
          config: { "limits.cpu": String(cpu), "limits.memory": `${mem}MiB` },
          devices: { root: { path: "/", pool: "default", type: "disk" } },
          last_validation: { ok: true, ran_at: new Date().toISOString(), notes: "ok" },
          created_at: new Date().toISOString(),
          project: { name, description: "New project (no description yet).", repo_url: "", branch: "main" },
        });
      }
    }, (i + 1) * 600));
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setStep(0); setLog([]); setDone(false); } }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Provision Incus instance</DialogTitle><DialogDescription>Step {Math.min(step + 1, 5)} of 5</DialogDescription></DialogHeader>
        {step === 0 && <div className="space-y-3"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>}
        {step === 1 && <div className="space-y-3"><Label>Image</Label><Select value={image} onValueChange={setImage}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ubuntu/24.04">ubuntu/24.04</SelectItem><SelectItem value="debian/12">debian/12</SelectItem><SelectItem value="alpine/3.20">alpine/3.20</SelectItem></SelectContent></Select></div>}
        {step === 2 && <div className="space-y-3"><Label>CPU cores</Label><Input type="number" value={cpu} onChange={(e) => setCpu(+e.target.value)} /></div>}
        {step === 3 && <div className="space-y-3"><Label>Memory (MiB)</Label><Input type="number" value={mem} onChange={(e) => setMem(+e.target.value)} /></div>}
        {step === 4 && (
          <div className="space-y-2">
            <div className="rounded-md border bg-[oklch(0.14_0.01_260)] text-[oklch(0.92_0.01_260)] p-3 font-mono text-xs h-48 overflow-auto">
              {log.map((l, i) => <div key={i} className="flex gap-2"><Loader2 className="size-3 animate-spin text-primary mt-0.5" />{l}</div>)}
              {done && <div className="flex items-center gap-2 text-[var(--success)] mt-2"><CheckCircle2 className="size-4" /> Provisioning complete</div>}
            </div>
          </div>
        )}
        <DialogFooter>
          {step > 0 && step < 4 && <Button variant="outline" onClick={() => setStep(step - 1)}>Back</Button>}
          {step < 3 && <Button onClick={() => setStep(step + 1)}>Next</Button>}
          {step === 3 && <Button onClick={start}>Provision</Button>}
          {step === 4 && done && <Button onClick={() => { onOpenChange(false); setStep(0); }}>Done</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
