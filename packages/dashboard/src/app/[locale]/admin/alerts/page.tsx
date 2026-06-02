"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/sys-pilot/PageHeader";
import { DataTable, type Column } from "@/components/sys-pilot/DataTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/sys-pilot/ConfirmDialog";
import { api } from "@/lib/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { AlertRule } from "@/lib/types";

const CONDITIONS = ["offline", "online", "response_time"] as const;

export default function AdminAlertsPage() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ["alerts", "rules"], queryFn: api.alerts.rules });

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [condition, setCondition] = useState<(typeof CONDITIONS)[number]>("offline");
  const [thresholdMs, setThresholdMs] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["alerts", "rules"] });

  const resetForm = () => {
    setName("");
    setServiceId("");
    setCondition("offline");
    setThresholdMs("");
  };

  const createRule = async () => {
    const svc = parseInt(serviceId, 10);
    if (!name.trim() || Number.isNaN(svc)) {
      toast.error("Name and a numeric Service ID are required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_id: svc,
          name: name.trim(),
          condition,
          threshold_ms: thresholdMs.trim() ? Number(thresholdMs) : null,
          enabled: true,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "Failed to create rule");
      toast.success(`Created ${name.trim()}`);
      setCreateOpen(false);
      resetForm();
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create rule");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleRule = async (r: AlertRule) => {
    try {
      const res = await fetch("/api/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: Number(r.id), enabled: !r.enabled }),
      });
      if (!res.ok) throw new Error("Failed to update rule");
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update rule");
    }
  };

  const deleteRule = async (r: AlertRule) => {
    try {
      const res = await fetch(`/api/alerts?id=${encodeURIComponent(r.id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete rule");
      toast.success(`Deleted ${r.name}`);
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete rule");
    }
  };

  const columns: Column<AlertRule>[] = [
    { key: "name", header: "Rule", sort: (r) => r.name, cell: (r) => <span className="font-medium">{r.name}</span> },
    { key: "service", header: "Service ID", sort: (r) => r.service_id, cell: (r) => <code className="text-xs text-muted-foreground">#{r.service_id}</code> },
    { key: "condition", header: "Condition", sort: (r) => r.condition, cell: (r) => <Badge variant="outline" className="text-[10px]">{r.condition}</Badge> },
    { key: "threshold", header: "Threshold", cell: (r) => <span className="tabular-nums text-xs">{r.threshold_ms ? `${r.threshold_ms}ms` : "—"}</span> },
    { key: "enabled", header: "Enabled", cell: (r) => <Switch checked={r.enabled} onCheckedChange={() => toggleRule(r)} /> },
    { key: "actions", header: "", className: "text-right", cell: (r) => (
      <div className="flex justify-end gap-1">
        <ConfirmDialog
          trigger={<Button size="sm" variant="ghost"><Trash2 className="size-3.5 text-destructive" /></Button>}
          title={`Delete rule "${r.name}"?`}
          destructive
          confirmLabel="Delete"
          onConfirm={() => deleteRule(r)}
        />
      </div>
    ) },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Alert Rules (Admin)"
        description={`${data.length} rules · ${data.filter((r) => r.enabled).length} enabled`}
        actions={
          <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger render={<Button size="sm" />}>
              <Plus className="size-4 mr-1" />New rule
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New alert rule</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs">Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="API offline" autoFocus />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Service ID</Label>
                  <Input type="number" value={serviceId} onChange={(e) => setServiceId(e.target.value)} placeholder="1" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Condition</Label>
                  <Select value={condition} onValueChange={(v) => setCondition(v as (typeof CONDITIONS)[number])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CONDITIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Threshold (ms)</Label>
                  <Input type="number" value={thresholdMs} onChange={(e) => setThresholdMs(e.target.value)} placeholder="optional" disabled={condition !== "response_time"} />
                </div>
              </div>
              <DialogFooter>
                <Button size="sm" variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button size="sm" onClick={createRule} disabled={submitting}>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      <DataTable rows={data} columns={columns} loading={isLoading} initialSort="name"
        filterFn={(r, q) => r.name.toLowerCase().includes(q)} />
    </div>
  );
}
