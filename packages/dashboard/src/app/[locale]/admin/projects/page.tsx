"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/sys-pilot/PageHeader";
import { DataTable, type Column } from "@/components/sys-pilot/DataTable";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/sys-pilot/ConfirmDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Project } from "@/lib/types";

// Backend shape returned by GET /api/projects (src/lib/db/projects.ts).
interface BackendProject {
  id: number;
  slug: string;
  name: string;
  repo_url: string | null;
  primary_pm_account: string | null;
  messaging_mode: "single" | "distributed";
  settings: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

function toUiProject(p: BackendProject): Project {
  const settings = p.settings ?? {};
  return {
    slug: p.slug,
    name: p.name,
    description:
      typeof settings.description === "string" ? settings.description : "",
    repo_url: p.repo_url ?? "",
    branch: typeof settings.branch === "string" ? settings.branch : "main",
    created_at: p.created_at,
  };
}

async function fetchProjects(): Promise<Project[]> {
  const res = await fetch("/api/projects");
  if (!res.ok) throw new Error("Failed to load projects");
  const json = (await res.json()) as { projects: BackendProject[] };
  return (json.projects ?? []).map(toUiProject);
}

type FormState = {
  slug: string;
  name: string;
  repo_url: string;
  messaging_mode: "single" | "distributed";
};

const EMPTY_FORM: FormState = {
  slug: "",
  name: "",
  repo_url: "",
  messaging_mode: "single",
};

export default function AdminProjectsPage() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: fetchProjects,
  });

  const [open, setOpen] = useState(false);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setEditingSlug(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  };

  const openEdit = (r: Project) => {
    setEditingSlug(r.slug);
    setForm({
      slug: r.slug,
      name: r.name,
      repo_url: r.repo_url,
      messaging_mode: "single",
    });
    setOpen(true);
  };

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["projects"] });

  const handleSave = async () => {
    if (!form.name.trim() || (!editingSlug && !form.slug.trim())) {
      toast.error("Slug and name are required");
      return;
    }
    setSaving(true);
    try {
      let res: Response;
      if (editingSlug) {
        res = await fetch(
          `/api/projects?slug=${encodeURIComponent(editingSlug)}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: form.name,
              repo_url: form.repo_url || null,
              messaging_mode: form.messaging_mode,
            }),
          },
        );
      } else {
        res = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug: form.slug,
            name: form.name,
            repo_url: form.repo_url || null,
            messaging_mode: form.messaging_mode,
          }),
        });
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Request failed");
      }
      toast.success(editingSlug ? "Project updated" : "Project created");
      setOpen(false);
      await invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save project");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (r: Project) => {
    try {
      const res = await fetch(
        `/api/projects?slug=${encodeURIComponent(r.slug)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Request failed");
      }
      toast.success(`Deleted ${r.name}`);
      await invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete project");
    }
  };

  const columns: Column<Project>[] = [
    { key: "name", header: "Project", sort: (r) => r.name, cell: (r) => (
      <div>
        <div className="font-medium">{r.name}</div>
        <code className="text-[10px] text-muted-foreground">{r.slug}</code>
      </div>
    ) },
    { key: "desc", header: "Description", cell: (r) => <span className="text-muted-foreground text-xs">{r.description}</span> },
    { key: "repo", header: "Repo", cell: (r) => (
      r.repo_url ? (
        <a href={r.repo_url} className="text-xs text-primary inline-flex items-center gap-1 hover:underline" target="_blank" rel="noreferrer">
          {r.repo_url.replace("https://", "")} <ExternalLink className="size-3" />
        </a>
      ) : <span className="text-xs text-muted-foreground">—</span>
    ) },
    { key: "branch", header: "Branch", cell: (r) => <code className="text-xs">{r.branch}</code> },
    { key: "created_at", header: "Created", sort: (r) => r.created_at, cell: (r) => <span className="text-xs text-muted-foreground">{r.created_at.slice(0, 10)}</span> },
    { key: "actions", header: "", className: "text-right", cell: (r) => (
      <div className="flex justify-end gap-1">
        <Button size="sm" variant="ghost" onClick={() => openEdit(r)}><Pencil className="size-3.5" /></Button>
        <ConfirmDialog
          trigger={<Button size="sm" variant="ghost"><Trash2 className="size-3.5 text-destructive" /></Button>}
          title={`Delete project ${r.name}?`}
          destructive
          confirmLabel="Delete"
          requireText={r.slug}
          onConfirm={() => handleDelete(r)}
        />
      </div>
    ) },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Manage Projects"
        description={`${data.length} projects`}
        actions={<Button size="sm" onClick={openCreate}><Plus className="size-4 mr-1" />New project</Button>}
      />
      <DataTable rows={data} columns={columns} loading={isLoading} initialSort="name"
        filterFn={(r, q) => r.name.toLowerCase().includes(q) || r.slug.includes(q)} />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSlug ? "Edit project" : "New project"}</DialogTitle>
            <DialogDescription>
              {editingSlug ? "Update project details." : "Create a new project."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="proj-slug" className="text-xs">Slug</Label>
              <Input
                id="proj-slug"
                value={form.slug}
                disabled={!!editingSlug}
                placeholder="my-project"
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="proj-name" className="text-xs">Name</Label>
              <Input
                id="proj-name"
                value={form.name}
                placeholder="My Project"
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="proj-repo" className="text-xs">Repo URL</Label>
              <Input
                id="proj-repo"
                value={form.repo_url}
                placeholder="https://github.com/org/repo"
                onChange={(e) => setForm((f) => ({ ...f, repo_url: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Messaging mode</Label>
              <Select
                value={form.messaging_mode}
                onValueChange={(v) => setForm((f) => ({ ...f, messaging_mode: v as FormState["messaging_mode"] }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">single</SelectItem>
                  <SelectItem value="distributed">distributed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : editingSlug ? "Save" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
