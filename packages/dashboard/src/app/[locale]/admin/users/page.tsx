"use client";

import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/sys-pilot/PageHeader";
import { DataTable, type Column } from "@/components/sys-pilot/DataTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/sys-pilot/ConfirmDialog";
import type { PamUser } from "@/lib/types";

// TODO: rewire to real API
export default function AdminUsersPage() {
  const data: PamUser[] = [];
  const isLoading = false;

  const columns: Column<PamUser>[] = [
    { key: "username", header: "Username", sort: (r) => r.username, cell: (r) => <span className="font-medium">{r.username}</span> },
    { key: "uid", header: "UID", sort: (r) => r.uid, cell: (r) => <code className="text-xs text-muted-foreground">{r.uid}</code> },
    { key: "groups", header: "Groups", cell: (r) => (
      <div className="flex flex-wrap gap-1">{r.groups.map((g: string) => <Badge key={g} variant="secondary" className="text-[10px]">{g}</Badge>)}</div>
    ) },
    { key: "role", header: "Role", cell: (r) => <Badge variant={r.is_admin ? "default" : "outline"} className="text-[10px]">{r.is_admin ? "Admin" : "Standard"}</Badge> },
    { key: "actions", header: "", className: "text-right", cell: (r) => (
      <ConfirmDialog
        trigger={<Button size="sm" variant="ghost"><Trash2 className="size-3.5 text-destructive" /></Button>}
        title={`Remove ${r.username}?`}
        description="Removes PAM user from the registry. Local UNIX account is not modified."
        destructive
        confirmLabel="Remove"
        requireText={r.username}
        onConfirm={() => toast.success(`Removed ${r.username}`)}
      />
    ) },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Manage Users"
        description={`${data.length} PAM users · ${data.filter((u) => u.is_admin).length} admin`}
        actions={<Button size="sm" onClick={() => toast.info("Invite user (mock)")}><Plus className="size-4 mr-1" />Invite</Button>}
      />
      <DataTable
        rows={data}
        columns={columns}
        loading={isLoading}
        initialSort="username"
        filterFn={(r, q) => r.username.toLowerCase().includes(q) || r.groups.some((g: string) => g.includes(q))}
      />
    </div>
  );
}
