"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/sys-pilot/PageHeader";
import { TechIcon } from "@/components/sys-pilot/TechIcon";
import { StatusBadge } from "@/components/sys-pilot/StatusBadge";
import { DataTable, type Column } from "@/components/sys-pilot/DataTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/sys-pilot/ConfirmDialog";
import type { Service } from "@/lib/types";

type AdminServiceRow = Partial<Service> & {
  id: number;
  slug: string;
  name: string;
  category: string;
  health_url: string;
  health_type: Service["health_type"];
  is_active: boolean;
};

function normalize(r: AdminServiceRow): Service {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    open_url: r.open_url ?? "#",
    category: r.category ?? "Infrastructure",
    status: r.status ?? "unknown",
    responseTime: r.responseTime ?? 0,
    icon_color: r.icon_color ?? null,
    icon_image: r.icon_image ?? null,
    kind: r.kind ?? "service",
    health_url: r.health_url,
    health_type: r.health_type,
    description: r.description ?? null,
    env_source: r.env_source ?? null,
    is_active: r.is_active,
    has_webui: r.has_webui ?? false,
    show_in_healthcheck: r.show_in_healthcheck ?? false,
    show_in_webui: r.show_in_webui ?? false,
    sort_order: r.sort_order ?? 0,
    icon_type: r.icon_type ?? "auto",
    badges: r.badges ?? [],
  };
}

async function fetchServices(): Promise<Service[]> {
  const res = await fetch("/api/admin/services?all=1", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load services");
  const json = (await res.json()) as { services: AdminServiceRow[] };
  return (json.services ?? []).map(normalize);
}

type FormState = {
  id?: number;
  slug: string;
  name: string;
  category: string;
  health_url: string;
  open_url: string;
  health_type: Service["health_type"];
};

const EMPTY_FORM: FormState = {
  slug: "",
  name: "",
  category: "Infrastructure",
  health_url: "",
  open_url: "",
  health_type: "http",
};

export default function AdminServicesPage() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ["admin-services"], queryFn: fetchServices });

  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);

  const openCreate = () => setForm({ ...EMPTY_FORM });
  const openEdit = (r: Service) =>
    setForm({
      id: r.id,
      slug: r.slug,
      name: r.name,
      category: r.category,
      health_url: r.health_url,
      open_url: r.open_url,
      health_type: r.health_type,
    });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-services"] });

  const save = async () => {
    if (!form) return;
    const isEdit = form.id !== undefined;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/services", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Request failed");
      }
      toast.success(isEdit ? `Updated ${form.name}` : `Created ${form.name}`);
      setForm(null);
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save service");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (r: Service) => {
    try {
      const res = await fetch(`/api/admin/services?id=${r.id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Request failed");
      }
      toast.success(`Deleted ${r.name}`);
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete service");
    }
  };

  const columns: Column<Service>[] = [
    {
      key: "name", header: "Service", sort: (r) => r.name,
      cell: (r) => (
        <div className="flex items-center gap-2.5">
          <TechIcon slug={r.slug} name={r.name} size={24} />
          <div>
            <div className="font-medium text-foreground">{r.name}</div>
            <div className="text-xs text-muted-foreground">{r.slug}</div>
          </div>
        </div>
      ),
    },
    { key: "category", header: "Category", sort: (r) => r.category, cell: (r) => <span className="text-muted-foreground">{r.category}</span> },
    { key: "kind", header: "Kind", sort: (r) => r.kind, cell: (r) => <Badge variant="outline" className="text-[10px]">{r.kind}</Badge> },
    { key: "type", header: "Health", sort: (r) => r.health_type, cell: (r) => <code className="text-xs">{r.health_type}</code> },
    { key: "status", header: "Status", sort: (r) => r.status, cell: (r) => <StatusBadge status={r.status} /> },
    { key: "active", header: "Active", cell: (r) => <Badge variant={r.is_active ? "default" : "secondary"} className="text-[10px]">{r.is_active ? "Yes" : "No"}</Badge> },
    {
      key: "actions", header: "", className: "text-right",
      cell: (r) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" onClick={() => openEdit(r)}><Pencil className="size-3.5" /></Button>
          <ConfirmDialog
            trigger={<Button size="sm" variant="ghost"><Trash2 className="size-3.5 text-destructive" /></Button>}
            title={`Delete ${r.name}?`}
            description="This will remove the service from the registry."
            destructive
            confirmLabel="Delete"
            requireText={r.slug}
            onConfirm={() => { void remove(r); }}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Manage Services"
        description={`${data.length} services registered`}
        actions={<Button size="sm" onClick={openCreate}><Plus className="size-4 mr-1" />Add service</Button>}
      />
      <DataTable
        rows={data}
        columns={columns}
        loading={isLoading}
        initialSort="name"
        filterFn={(r, q) => r.name.toLowerCase().includes(q) || r.slug.includes(q) || r.category.toLowerCase().includes(q)}
      />

      <Dialog open={form !== null} onOpenChange={(o) => { if (!o) setForm(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form?.id !== undefined ? "Edit service" : "Add service"}</DialogTitle>
            <DialogDescription>
              {form?.id !== undefined ? "Update the service registry entry." : "Register a new service."}
            </DialogDescription>
          </DialogHeader>
          {form && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="My Service" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Slug</Label>
                <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="my-service" disabled={form.id !== undefined} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Category</Label>
                <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Infrastructure" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Open URL</Label>
                <Input value={form.open_url} onChange={(e) => setForm({ ...form, open_url: e.target.value })} placeholder="https://..." />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Health URL</Label>
                <Input value={form.health_url} onChange={(e) => setForm({ ...form, health_url: e.target.value })} placeholder="https://.../health" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Health type</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  value={form.health_type}
                  onChange={(e) => setForm({ ...form, health_type: e.target.value as Service["health_type"] })}
                >
                  <option value="http">http</option>
                  <option value="tcp">tcp</option>
                  <option value="docker">docker</option>
                  <option value="systemd">systemd</option>
                  <option value="process">process</option>
                </select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setForm(null)} disabled={saving}>Cancel</Button>
            <Button onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
