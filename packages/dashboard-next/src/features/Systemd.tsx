import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Play, Square, RotateCw, Server } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { DataTable, type Column } from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { api } from "@/mocks/api";
import { useT } from "@/hooks/useT";
import { useAuth } from "@/hooks/useAuth";
import type { SystemdUnit } from "@/mocks/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function SystemdPage() {
  const t = useT();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: units = [], isLoading } = useQuery({ queryKey: ["systemd"], queryFn: api.systemd });
  const isAdmin = !!user?.is_admin;

  const setActive = (name: string, active: SystemdUnit["active"]) => {
    qc.setQueryData<SystemdUnit[]>(["systemd"], (p) => p?.map((u) => u.name === name ? { ...u, active, sub: active === "active" ? "running" : "dead" } : u));
  };
  const setEnabled = (name: string, enabled: boolean) => {
    qc.setQueryData<SystemdUnit[]>(["systemd"], (p) => p?.map((u) => u.name === name ? { ...u, enabled } : u));
  };

  const cols: Column<SystemdUnit>[] = [
    { key: "name", header: "Unit", sort: (r) => r.name, cell: (r) => <Link to="/systemd/$unit" params={{ unit: r.name }} className="font-mono text-xs hover:underline">{r.name}</Link> },
    { key: "desc", header: "Description", sort: (r) => r.description, cell: (r) => <span className="text-sm">{r.description}</span> },
    { key: "load", header: "Load", cell: (r) => <Badge variant="outline">{r.load}</Badge> },
    {
      key: "active", header: "Active", sort: (r) => r.active,
      cell: (r) => <Badge variant="outline" className={cn(r.active === "active" && "border-[var(--success)] text-[var(--success)]", r.active === "failed" && "border-[var(--destructive)] text-[var(--destructive)]")}>{r.active}</Badge>
    },
    { key: "sub", header: "Sub", cell: (r) => <span className="text-xs text-muted-foreground">{r.sub}</span> },
    {
      key: "enabled", header: "Enabled", cell: (r) =>
        <Switch checked={r.enabled} disabled={!isAdmin} onCheckedChange={(v) => { setEnabled(r.name, v); toast.success(`${r.name} ${v ? "enabled" : "disabled"}`); }} />
    },
    {
      key: "act", header: "", className: "text-right", cell: (r) => (
        <div className="flex justify-end gap-1">
          {r.active !== "active" ? <Button size="sm" variant="ghost" disabled={!isAdmin} onClick={() => { setActive(r.name, "active"); toast.success(`Started ${r.name}`); }}><Play className="size-3.5" /></Button> :
            <Button size="sm" variant="ghost" disabled={!isAdmin} onClick={() => { setActive(r.name, "inactive"); toast.success(`Stopped ${r.name}`); }}><Square className="size-3.5" /></Button>}
          <Button size="sm" variant="ghost" disabled={!isAdmin} onClick={() => { setActive(r.name, "active"); toast.success(`Restarted ${r.name}`); }}><RotateCw className="size-3.5" /></Button>
        </div>
      )
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader icon={<Server className="size-5" />} title={t.nav.systemd} description={`${units.length} units · ${units.filter((u) => u.active === "active").length} active`} />
      <DataTable columns={cols} initialSort="name" server={{ queryKey: ["systemd"], fetch: api.systemdList }} />
    </div>
  );
}
