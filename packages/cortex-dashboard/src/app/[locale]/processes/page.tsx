"use client";

import { Cpu } from "lucide-react";
import { PageHeader } from "@/components/sys-pilot/PageHeader";
import { DataTable, type Column } from "@/components/sys-pilot/DataTable";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api";

import { useQuery } from "@tanstack/react-query";
import type { ProcessInfo } from "@/lib/types";

export default function ProcessesPage() {
  const { data: procs = [], isLoading } = useQuery({ queryKey: ["processes"], queryFn: api.processes, refetchInterval: 3000 });

  const cols: Column<ProcessInfo>[] = [
    { key: "pid", header: "PID", sort: (r) => r.pid, className: "tabular-nums w-20", cell: (r) => <span className="font-mono">{r.pid}</span> },
    { key: "user", header: "User", sort: (r) => r.user, cell: (r) => <span className="text-sm">{r.user}</span> },
    { key: "cmd", header: "Command", cell: (r) => <span className="font-mono text-xs truncate block max-w-[420px]">{r.command}</span> },
    { key: "cpu", header: "CPU %", sort: (r) => r.cpu, className: "w-44", cell: (r) => <div className="flex items-center gap-2"><Progress value={r.cpu} className="h-1.5 w-20" /><span className="tabular-nums text-xs">{r.cpu.toFixed(1)}</span></div> },
    { key: "mem", header: "MEM %", sort: (r) => r.mem, className: "w-44", cell: (r) => <div className="flex items-center gap-2"><Progress value={r.mem} className="h-1.5 w-20" /><span className="tabular-nums text-xs">{r.mem.toFixed(1)}</span></div> },
  ];

  return (
    <div className="space-y-5">
      <PageHeader icon={<Cpu className="size-5" />} title={"Processes"} description={`${procs.length} processes`} />
      <DataTable rows={procs} columns={cols} loading={isLoading} initialSort="cpu" filterFn={(r, q) => r.command.toLowerCase().includes(q) || r.user.includes(q) || String(r.pid).includes(q)} pageSize={50} />
    </div>
  );
}
