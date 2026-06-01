"use client";

import { useState } from "react";
import useSWR from "swr";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Check, XCircle } from "lucide-react";

interface Badge {
  id: number;
  service_id: number;
  label: string;
  color: string;
}

export interface BadgeManagerProps {
  serviceId: number;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function BadgeManager({ serviceId }: BadgeManagerProps) {
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState("#3b82f6");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editColor, setEditColor] = useState("");

  const { data, isLoading, mutate } = useSWR<{ badges: Badge[] }>(
    `/api/badges?service_id=${serviceId}`,
    fetcher,
  );
  const badges = data?.badges || [];

  const addBadge = async () => {
    if (!newLabel.trim()) return;
    try {
      const res = await fetch("/api/badges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service_id: serviceId, label: newLabel.trim(), color: newColor }),
      });
      if (res.ok) {
        setNewLabel("");
        setNewColor("#3b82f6");
        await mutate();
      }
    } catch {
      // ignore
    }
  };

  const deleteBadge = async (id: number) => {
    try {
      const res = await fetch(`/api/badges?id=${id}`, { method: "DELETE" });
      if (res.ok) await mutate();
    } catch {
      // ignore
    }
  };

  const startEdit = (badge: Badge) => {
    setEditingId(badge.id);
    setEditLabel(badge.label);
    setEditColor(badge.color);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditLabel("");
    setEditColor("");
  };

  const saveEdit = async (id: number) => {
    try {
      const res = await fetch("/api/badges", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, label: editLabel.trim(), color: editColor }),
      });
      if (res.ok) {
        setEditingId(null);
        await mutate();
      }
    } catch {
      // ignore
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
        Loading badges…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label htmlFor="badge-new-label" className="mb-1 block text-xs text-muted-foreground">Label</label>
          <Input
            id="badge-new-label"
            placeholder="Label"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="badge-new-color" className="mb-1 block text-xs text-muted-foreground">Color</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              id="badge-new-color"
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              className="size-8 cursor-pointer rounded border-0 bg-transparent"
            />
            <span className="font-mono text-xs text-muted-foreground">{newColor}</span>
          </div>
        </div>
        <Button onClick={addBadge} className="mb-0.5">Add Badge</Button>
      </div>

      {badges.length === 0 ? (
        <div className="rounded-lg border border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          No badges yet.
        </div>
      ) : (
        <ul className="space-y-2">
          {badges.map((badge) => (
            <li
              key={badge.id}
              className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
            >
              {editingId === badge.id ? (
                <div className="flex flex-1 items-center gap-2">
                  <Input
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    className="w-40"
                  />
                  <input
                    type="color"
                    value={editColor}
                    onChange={(e) => setEditColor(e.target.value)}
                    data-testid="edit-color"
                    className="size-8 cursor-pointer rounded border-0 bg-transparent"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => saveEdit(badge.id)}
                    title="Save"
                    aria-label="Save badge"
                    className="text-success hover:text-success"
                  >
                    <Check className="size-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={cancelEdit}
                    title="Cancel"
                    aria-label="Cancel edit"
                  >
                    <XCircle className="size-3.5" />
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block size-3 rounded-full"
                      style={{ backgroundColor: badge.color }}
                    />
                    <span className="text-sm text-foreground">{badge.label}</span>
                    <span className="font-mono text-xs text-muted-foreground">{badge.color}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => startEdit(badge)}
                      title="Edit"
                      aria-label={`Edit ${badge.label}`}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => deleteBadge(badge.id)}
                      title="Delete"
                      aria-label={`Delete ${badge.label}`}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
