"use client";

import { useEffect, useState } from "react";
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

export function BadgeManager({ serviceId }: BadgeManagerProps) {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState("#3b82f6");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editColor, setEditColor] = useState("");

  const fetchBadges = async () => {
    try {
      const res = await fetch(`/api/badges?service_id=${serviceId}`);
      if (res.ok) {
        const data = await res.json();
        setBadges(data.badges || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/badges?service_id=${serviceId}`);
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setBadges(data.badges || []);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [serviceId]);

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
        await fetchBadges();
      }
    } catch {
      // ignore
    }
  };

  const deleteBadge = async (id: number) => {
    try {
      const res = await fetch(`/api/badges?id=${id}`, { method: "DELETE" });
      if (res.ok) await fetchBadges();
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
        await fetchBadges();
      }
    } catch {
      // ignore
    }
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
        Loading badges...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className="mb-1 block text-xs text-muted-foreground">Label</label>
          <Input
            placeholder="Label"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Color</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              className="h-8 w-8 cursor-pointer rounded border-0 bg-transparent"
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
                    className="h-8 w-8 cursor-pointer rounded border-0 bg-transparent"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => saveEdit(badge.id)}
                    title="Save"
                    className="text-success hover:text-success"
                  >
                    <Check className="size-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={cancelEdit}
                    title="Cancel"
                  >
                    <XCircle className="size-3.5" />
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-3 w-3 rounded-full"
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
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => deleteBadge(badge.id)}
                      title="Delete"
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
