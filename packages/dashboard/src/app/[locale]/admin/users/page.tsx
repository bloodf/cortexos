"use client";

import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/sys-pilot/PageHeader";
import { DataTable, type Column } from "@/components/sys-pilot/DataTable";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import type { PamUser } from "@/lib/types";

// Accounts are owned by the host OS via PAM — the dashboard cannot create,
// delete, or change roles (the /api/admin/users mutations return HTTP 405).
// This page is a read-only view of the operators who have signed in.
export default function AdminUsersPage() {
  const { data = [], isLoading } = useQuery({ queryKey: ["users"], queryFn: api.users });

  const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : "—");

  const columns: Column<PamUser>[] = [
    { key: "username", header: "Username", sort: (r) => r.username, cell: (r) => <span className="font-medium">{r.username}</span> },
    { key: "last_login_at", header: "Last login", sort: (r) => r.last_login_at ?? "", cell: (r) => <span className="text-xs text-muted-foreground tabular-nums">{fmt(r.last_login_at)}</span> },
    { key: "active_sessions", header: "Active sessions", sort: (r) => r.active_sessions, cell: (r) => (
      <Badge variant={r.active_sessions > 0 ? "default" : "outline"} className="text-[10px] tabular-nums">{r.active_sessions}</Badge>
    ) },
    { key: "created_at", header: "First seen", sort: (r) => r.created_at, cell: (r) => <span className="text-xs text-muted-foreground tabular-nums">{fmt(r.created_at)}</span> },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Users"
        description={`${data.length} operators · accounts managed by host PAM`}
      />
      <DataTable
        rows={data}
        columns={columns}
        loading={isLoading}
        initialSort="last_login_at"
        filterFn={(r, q) => r.username.toLowerCase().includes(q)}
      />
    </div>
  );
}
