import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { DataTable, type Column } from "@/components/DataTable";
import { TableSkeleton } from "@/components/skeletons";
import { EmptyState } from "@/components/EmptyState";
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
import { api, callCreateAlert, callPatchAlert, callDeleteAlert } from "@/lib/api/client";
import { csrfHeaders } from "./csrf";
import type { AlertRule } from "@/mocks/types";

type Condition = "offline" | "online" | "response_time";
const CONDITIONS: Condition[] = ["offline", "online", "response_time"];

interface FormState {
  serviceId: string;
  name: string;
  condition: Condition;
  thresholdMs: string;
  enabled: boolean;
}

const EMPTY_FORM: FormState = {
  serviceId: "",
  name: "",
  condition: "offline",
  thresholdMs: "",
  enabled: true,
};

export function AdminAlertsPage() {
  const qc = useQueryClient();
  const {
    data = [],
    isLoading,
    isError,
  } = useQuery({ queryKey: ["alerts", "rules"], queryFn: api.alerts.rules });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AlertRule | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["alerts", "rules"] });

  const createMut = useMutation({
    mutationFn: (f: FormState) =>
      callCreateAlert({
        data: {
          serviceId: Number(f.serviceId),
          name: f.name,
          condition: f.condition,
          thresholdMs: f.thresholdMs ? Number(f.thresholdMs) : null,
          enabled: f.enabled,
        },
        headers: csrfHeaders(),
      }),
    onSuccess: () => {
      toast.success("Alert rule created");
      setDialogOpen(false);
      setForm(EMPTY_FORM);
      invalidate();
    },
    onError: () => toast.error("Failed to create alert rule"),
  });

  const patchMut = useMutation({
    mutationFn: (f: FormState & { id: number }) =>
      callPatchAlert({
        data: {
          id: f.id,
          name: f.name,
          condition: f.condition,
          thresholdMs: f.thresholdMs ? Number(f.thresholdMs) : null,
          enabled: f.enabled,
        },
        headers: csrfHeaders(),
      }),
    onSuccess: () => {
      toast.success("Alert rule updated");
      setDialogOpen(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      invalidate();
    },
    onError: () => toast.error("Failed to update alert rule"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => callDeleteAlert({ data: { id }, headers: csrfHeaders() }),
    onSuccess: () => {
      toast.success("Alert rule deleted");
      invalidate();
    },
    onError: () => toast.error("Failed to delete alert rule"),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (r: AlertRule) => {
    setEditing(r);
    setForm({
      serviceId: String(r.service_id),
      name: r.name,
      condition: r.condition,
      thresholdMs: r.threshold_ms ? String(r.threshold_ms) : "",
      enabled: r.enabled,
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!form.serviceId || !form.name) {
      toast.error("Service ID and name are required");
      return;
    }
    if (editing) {
      patchMut.mutate({ ...form, id: Number(editing.id) });
    } else {
      createMut.mutate(form);
    }
  };

  const isPending = createMut.isPending || patchMut.isPending;

  const columns: Column<AlertRule>[] = [
    {
      key: "name",
      header: "Rule",
      sort: (r) => r.name,
      cell: (r) => <span className="font-medium">{r.name}</span>,
    },
    {
      key: "service",
      header: "Service ID",
      sort: (r) => r.service_id,
      cell: (r) => <code className="text-xs text-muted-foreground">#{r.service_id}</code>,
    },
    {
      key: "condition",
      header: "Condition",
      sort: (r) => r.condition,
      cell: (r) => (
        <Badge variant="outline" className="text-[10px]">
          {r.condition}
        </Badge>
      ),
    },
    {
      key: "threshold",
      header: "Threshold",
      cell: (r) => (
        <span className="tabular-nums text-xs">{r.threshold_ms ? `${r.threshold_ms}ms` : "—"}</span>
      ),
    },
    {
      key: "enabled",
      header: "Enabled",
      cell: (r) => (
        <Badge variant={r.enabled ? "default" : "secondary"} className="text-[10px]">
          {r.enabled ? "on" : "off"}
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
            title={`Delete rule "${r.name}"?`}
            destructive
            confirmLabel="Delete"
            onConfirm={() => deleteMut.mutate(Number(r.id))}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Alert Rules (Admin)"
        description={`${data.length} rules · ${data.filter((r) => r.enabled).length} enabled`}
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus className="size-4 mr-1" />
            New rule
          </Button>
        }
      />

      {isLoading ? (
        <TableSkeleton rows={6} cols={5} />
      ) : isError ? (
        <EmptyState
          title="Failed to load alert rules"
          description="Could not reach the alerts service."
          action={
            <Button
              size="sm"
              variant="outline"
              onClick={() => qc.invalidateQueries({ queryKey: ["alerts", "rules"] })}
            >
              Retry
            </Button>
          }
        />
      ) : (
        <DataTable
          rows={data}
          columns={columns}
          loading={isLoading}
          initialSort="name"
          filterFn={(r, q) => r.name.toLowerCase().includes(q)}
        />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit alert rule" : "New alert rule"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Update the alert rule configuration."
                : "Create a new alert rule for a service."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="ar-service-id">Service ID</Label>
              <Input
                id="ar-service-id"
                type="number"
                placeholder="e.g. 1"
                value={form.serviceId}
                disabled={!!editing}
                onChange={(e) => setForm((f) => ({ ...f, serviceId: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ar-name">Rule name</Label>
              <Input
                id="ar-name"
                placeholder="e.g. API offline"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Condition</Label>
              <Select
                value={form.condition}
                onValueChange={(v) => setForm((f) => ({ ...f, condition: v as Condition }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONDITIONS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {form.condition === "response_time" && (
              <div className="space-y-1.5">
                <Label htmlFor="ar-threshold">Threshold (ms)</Label>
                <Input
                  id="ar-threshold"
                  type="number"
                  placeholder="e.g. 2000"
                  value={form.thresholdMs}
                  onChange={(e) => setForm((f) => ({ ...f, thresholdMs: e.target.value }))}
                />
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                id="ar-enabled"
                type="checkbox"
                className="size-4"
                checked={form.enabled}
                onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
              />
              <Label htmlFor="ar-enabled">Enabled</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending && <Loader2 className="size-4 mr-1 animate-spin" />}
              {editing ? "Save changes" : "Create rule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
