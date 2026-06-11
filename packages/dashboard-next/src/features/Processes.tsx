import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Cpu, List, Network, Search } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { DataTable, type Column } from "@/components/DataTable";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/EmptyState";
import { TableSkeleton } from "@/components/skeletons";
import { api } from "@/lib/api/client";
import { useT } from "@/hooks/useT";
import type { ProcessInfo } from "@/lib/api/client";

type View = "list" | "tree";

function TreeGroup({
  group,
}: {
  group: { user: string; items: ProcessInfo[]; cpu: number; mem: number };
}) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/40 text-sm"
        aria-expanded={open}
      >
        {open ? (
          <ChevronDown className="size-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-3.5 text-muted-foreground" />
        )}
        <span className="font-medium">{group.user}</span>
        <span className="text-xs text-muted-foreground">
          {group.items.length} proc{group.items.length === 1 ? "" : "s"}
        </span>
        <div className="flex-1" />
        <span className="text-xs text-muted-foreground tabular-nums">
          CPU {group.cpu.toFixed(1)}% · MEM {group.mem.toFixed(1)}%
        </span>
      </button>
      {open && (
        <ul className="bg-background/40">
          {group.items.map((p) => (
            <li
              key={p.pid}
              className="grid grid-cols-[80px_1fr_120px_120px] items-center gap-3 px-3 py-1.5 pl-9 text-xs hover:bg-muted/30 border-t"
            >
              <span className="font-mono tabular-nums text-muted-foreground">{p.pid}</span>
              <span className="font-mono truncate" title={p.command}>
                {p.command}
              </span>
              <div className="flex items-center gap-2">
                <Progress value={p.cpu} className="h-1 w-16" />
                <span className="tabular-nums">{p.cpu.toFixed(1)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Progress value={p.mem} className="h-1 w-16" />
                <span className="tabular-nums">{p.mem.toFixed(1)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TreeView({
  procs,
  loading,
  q,
  onQ,
}: {
  procs: ProcessInfo[];
  loading: boolean;
  q: string;
  onQ: (v: string) => void;
}) {
  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const map = new Map<string, ProcessInfo[]>();
    procs.forEach((p) => {
      if (
        needle &&
        !(
          p.command.toLowerCase().includes(needle) ||
          p.user.includes(needle) ||
          String(p.pid).includes(needle)
        )
      ) {
        return;
      }
      const arr = map.get(p.user) ?? [];
      arr.push(p);
      map.set(p.user, arr);
    });
    return [...map.entries()]
      .map(([user, items]) => ({
        user,
        items: items.sort((a, b) => b.cpu - a.cpu),
        cpu: items.reduce((s, x) => s + x.cpu, 0),
        mem: items.reduce((s, x) => s + x.mem, 0),
      }))
      .sort((a, b) => b.cpu - a.cpu);
  }, [procs, q]);

  if (loading) return <TableSkeleton rows={10} cols={5} />;

  return (
    <div className="space-y-3">
      <div className="relative max-w-md">
        <Search className="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => onQ(e.target.value)}
          placeholder="Filter by command, user or pid…"
          className="pl-8 h-9"
        />
      </div>

      {groups.length === 0 ? (
        <Card className="elev-1">
          <EmptyState
            icon={<Cpu className="size-7" />}
            title="No processes match"
            description="Try clearing the filter."
          />
        </Card>
      ) : (
        <div className="border rounded-md divide-y bg-card">
          {groups.map((g) => (
            <TreeGroup key={g.user} group={g} />
          ))}
        </div>
      )}
    </div>
  );
}

export function ProcessesPage() {
  const t = useT();
  const { data: procs = [], isLoading } = useQuery({
    queryKey: ["processes"],
    queryFn: api.processes,
    refetchInterval: 3000,
  });
  const [view, setView] = useState<View>("list");
  const [q, setQ] = useState("");

  const cols: Column<ProcessInfo>[] = [
    {
      key: "pid",
      header: "PID",
      sort: (r) => r.pid,
      className: "tabular-nums w-20",
      cell: (r) => <span className="font-mono">{r.pid}</span>,
    },
    {
      key: "user",
      header: "User",
      sort: (r) => r.user,
      cell: (r) => <span className="text-sm">{r.user}</span>,
    },
    {
      key: "cmd",
      header: "Command",
      cell: (r) => (
        <span className="font-mono text-xs truncate block max-w-[420px]">{r.command}</span>
      ),
    },
    {
      key: "cpu",
      header: "CPU %",
      sort: (r) => r.cpu,
      className: "w-44",
      cell: (r) => (
        <div className="flex items-center gap-2">
          <Progress value={r.cpu} className="h-1.5 w-20" />
          <span className="tabular-nums text-xs">{r.cpu.toFixed(1)}</span>
        </div>
      ),
    },
    {
      key: "mem",
      header: "MEM %",
      sort: (r) => r.mem,
      className: "w-44",
      cell: (r) => (
        <div className="flex items-center gap-2">
          <Progress value={r.mem} className="h-1.5 w-20" />
          <span className="tabular-nums text-xs">{r.mem.toFixed(1)}</span>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        icon={<Cpu className="size-5" />}
        title={t.nav.processes}
        description={`${procs.length} processes`}
        actions={
          <div className="flex items-center gap-1 rounded-md border p-0.5">
            <Button
              type="button"
              size="sm"
              variant={view === "list" ? "secondary" : "ghost"}
              className="h-7 px-2 text-xs gap-1.5"
              onClick={() => setView("list")}
              aria-pressed={view === "list"}
            >
              <List className="size-3.5" /> List
            </Button>
            <Button
              type="button"
              size="sm"
              variant={view === "tree" ? "secondary" : "ghost"}
              className="h-7 px-2 text-xs gap-1.5"
              onClick={() => setView("tree")}
              aria-pressed={view === "tree"}
            >
              <Network className="size-3.5" /> Tree
            </Button>
          </div>
        }
      />

      {view === "list" ? (
        <DataTable
          rows={procs}
          columns={cols}
          loading={isLoading}
          initialSort="cpu"
          filterFn={(r, query) =>
            r.command.toLowerCase().includes(query) || r.user.includes(query) || String(r.pid).includes(query)
          }
          paginate={false}
        />
      ) : (
        <TreeView procs={procs} loading={isLoading} q={q} onQ={setQ} />
      )}
    </div>
  );
}
