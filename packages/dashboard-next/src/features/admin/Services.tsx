import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { TechIcon } from "@/components/TechIcon";
import { StatusBadge } from "@/components/StatusBadge";
import { DataTable, type Column } from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { Service } from "@/mocks/types";
import {
  listAdminServices,
  createAdminService,
  patchAdminService,
  deleteAdminService,
  type ServiceCreateData,
} from "./rpc";

type HealthType = NonNullable<ServiceCreateData["healthType"]>;
type Kind = NonNullable<ServiceCreateData["kind"]>;

const HEALTH_TYPES: HealthType[] = ["http", "tcp", "docker", "systemd", "process"];
const KINDS: Kind[] = ["app", "service", "docker", "process", "dashboard-launcher"];

interface FormState {
  slug: string;
  name: string;
  category: string;
  healthType: HealthType;
  kind: Kind;
  healthUrl: string;
  openUrl: string;
  description: string;
}

const EMPTY_FORM: FormState = {
  slug: "",
  name: "",
  category: "",
  healthType: "http",
  kind: "service",
  healthUrl: "",
  openUrl: "",
  description: "",
};

export function AdminServicesPage() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ["services"], queryFn: listAdminServices });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["services"] });

  const createMut = useMutation({
    mutationFn: createAdminService,
    onSuccess: () => {
      toast.success("Service created");
      setDialogOpen(false);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message || "Failed to create service"),
  });

  const patchMut = useMutation({
    mutationFn: patchAdminService,
    onSuccess: () => {
      toast.success("Service updated");
      setDialogOpen(false);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message || "Failed to update service"),
  });

  const deleteMut = useMutation({
    mutationFn: deleteAdminService,
    onSuccess: () => {
      toast.success("Service deleted");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message || "Failed to delete service"),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (r: Service) => {
    setEditing(r);
    setForm({
      slug: r.slug,
      name: r.name,
      category: r.category,
      healthType: r.health_type as HealthType,
      kind: r.kind as Kind,
      healthUrl: r.health_url ?? "",
      openUrl: r.open_url ?? "",
      description: r.description ?? "",
    });
    setDialogOpen(true);
  };

  const submit = () => {
    if (editing) {
      patchMut.mutate({
        id: editing.id,
        slug: form.slug,
        name: form.name,
        category: form.category,
        healthType: form.healthType,
        kind: form.kind,
        healthUrl: form.healthUrl || null,
        openUrl: form.openUrl || null,
        description: form.description || null,
      });
    } else {
      createMut.mutate({
        slug: form.slug,
        name: form.name,
        category: form.category,
        healthType: form.healthType,
        kind: form.kind,
        healthUrl: form.healthUrl || null,
        openUrl: form.openUrl || null,
        description: form.description || null,
      });
    }
  };

  const saving = createMut.isPending || patchMut.isPending;
  const canSave = form.slug.trim() !== "" && form.name.trim() !== "" && form.category.trim() !== "";

  const columns: Column<Service>[] = [
    {
      key: "name",
      header: "Service",
      sort: (r) => r.name,
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
    {
      key: "category",
      header: "Category",
      sort: (r) => r.category,
      cell: (r) => <span className="text-muted-foreground">{r.category}</span>,
    },
    {
      key: "kind",
      header: "Kind",
      sort: (r) => r.kind,
      cell: (r) => (
        <Badge variant="outline" className="text-[10px]">
          {r.kind}
        </Badge>
      ),
    },
    {
      key: "type",
      header: "Health",
      sort: (r) => r.health_type,
      cell: (r) => <code className="text-xs">{r.health_type}</code>,
    },
    {
      key: "status",
      header: "Status",
      sort: (r) => r.status,
      cell: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: "active",
      header: "Active",
      cell: (r) => (
        <Badge variant={r.is_active ? "default" : "secondary"} className="text-[10px]">
          {r.is_active ? "Yes" : "No"}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      cell: (r) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>
            <Pencil className="size-3.5" />
          </Button>
          <ConfirmDialog
            trigger={
              <Button size="sm" variant="ghost">
                <Trash2 className="size-3.5 text-destructive" />
              </Button>
            }
            title={`Delete ${r.name}?`}
            description="This will remove the service from the registry."
            destructive
            confirmLabel="Delete"
            requireText={r.slug}
            onConfirm={() => deleteMut.mutate(r.id)}
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
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus className="size-4 mr-1" />
            Add service
          </Button>
        }
      />
      <DataTable
        rows={data}
        columns={columns}
        loading={isLoading}
        initialSort="name"
        filterFn={(r, q) =>
          r.name.toLowerCase().includes(q) ||
          r.slug.includes(q) ||
          r.category.toLowerCase().includes(q)
        }
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.name}` : "Add service"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Update the service registry entry."
                : "Register a new service in the catalog."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Slug</Label>
              <Input
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                placeholder="my-service"
                className="h-9 font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="My Service"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Category</Label>
              <Input
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                placeholder="infra"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Kind</Label>
              <Select
                value={form.kind}
                onValueChange={(v) => setForm((f) => ({ ...f, kind: v as Kind }))}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KINDS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {k}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Health type</Label>
              <Select
                value={form.healthType}
                onValueChange={(v) => setForm((f) => ({ ...f, healthType: v as HealthType }))}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HEALTH_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Health URL</Label>
              <Input
                value={form.healthUrl}
                onChange={(e) => setForm((f) => ({ ...f, healthUrl: e.target.value }))}
                placeholder="https://…"
                className="h-9 font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Open URL</Label>
              <Input
                value={form.openUrl}
                onChange={(e) => setForm((f) => ({ ...f, openUrl: e.target.value }))}
                placeholder="https://…"
                className="h-9 font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs">Description</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="h-9"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={submit} disabled={!canSave || saving}>
              {saving ? "Saving…" : editing ? "Save changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
