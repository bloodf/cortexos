"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/sys-pilot/PageHeader";
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
import { api } from "@/lib/api";
import type { Badge as BadgeType } from "@/lib/types";

interface BadgeForm {
  slug: string;
  label: string;
  color: string;
  text_color: string;
}

const EMPTY_FORM: BadgeForm = { slug: "", label: "", color: "#6366f1", text_color: "#ffffff" };

export default function AdminBadgesPage() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ["badges"], queryFn: api.badges });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BadgeType | null>(null);
  const [form, setForm] = useState<BadgeForm>(EMPTY_FORM);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (badge: BadgeType) => {
    setEditing(badge);
    setForm({ slug: badge.slug, label: badge.label, color: badge.color, text_color: badge.text_color });
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editing) {
        const res = await fetch(`/api/badges?slug=${encodeURIComponent(editing.slug)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label: form.label, color: form.color, text_color: form.text_color }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "Failed to update badge");
      } else {
        const res = await fetch("/api/badges", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "Failed to create badge");
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Badge updated" : "Badge created");
      setDialogOpen(false);
      qc.invalidateQueries({ queryKey: ["badges"] });
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : "Save failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (slug: string) => {
      const res = await fetch(`/api/badges?slug=${encodeURIComponent(slug)}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "Failed to delete badge");
    },
    onSuccess: (_d, slug) => {
      toast.success(`Deleted ${slug}`);
      qc.invalidateQueries({ queryKey: ["badges"] });
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : "Delete failed"),
  });

  const columns: Column<BadgeType>[] = [
    { key: "preview", header: "Preview", cell: (r) => (
      <Badge style={{ background: r.color, color: r.text_color }} className="text-[10px]">{r.label}</Badge>
    ) },
    { key: "slug", header: "Slug", sort: (r) => r.slug, cell: (r) => <code className="text-xs">{r.slug}</code> },
    { key: "label", header: "Label", sort: (r) => r.label, cell: (r) => r.label },
    { key: "color", header: "Color", cell: (r) => (
      <div className="flex items-center gap-2">
        <span className="size-4 rounded border" style={{ background: r.color }} />
        <code className="text-xs text-muted-foreground">{r.color}</code>
      </div>
    ) },
    { key: "actions", header: "", className: "text-right", cell: (r) => (
      <div className="flex justify-end gap-1">
        <Button size="sm" variant="ghost" onClick={() => openEdit(r)}><Pencil className="size-3.5" /></Button>
        <ConfirmDialog
          trigger={<Button size="sm" variant="ghost"><Trash2 className="size-3.5 text-destructive" /></Button>}
          title={`Delete badge "${r.label}"?`}
          destructive
          confirmLabel="Delete"
          onConfirm={() => deleteMutation.mutate(r.slug)}
        />
      </div>
    ) },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Manage Badges"
        description={`${data.length} badges`}
        actions={<Button size="sm" onClick={openCreate}><Plus className="size-4 mr-1" />New badge</Button>}
      />
      <DataTable rows={data} columns={columns} loading={isLoading} initialSort="slug"
        filterFn={(r, q) => r.slug.includes(q) || r.label.toLowerCase().includes(q)} />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit badge" : "New badge"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update the badge label and colors." : "Create a new badge."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Slug</Label>
              <Input
                value={form.slug}
                disabled={!!editing}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                placeholder="my-badge"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Label</Label>
              <Input
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="My Badge"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={form.color}
                    onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                    className="size-9 rounded border bg-transparent"
                  />
                  <Input value={form.color} onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Text color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={form.text_color}
                    onChange={(e) => setForm((f) => ({ ...f, text_color: e.target.value }))}
                    className="size-9 rounded border bg-transparent"
                  />
                  <Input value={form.text_color} onChange={(e) => setForm((f) => ({ ...f, text_color: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="pt-1">
              <span className="text-xs text-muted-foreground mr-2">Preview:</span>
              <Badge style={{ background: form.color, color: form.text_color }} className="text-[10px]">
                {form.label || "label"}
              </Badge>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !form.slug.trim() || !form.label.trim()}
            >
              {editing ? "Save changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
