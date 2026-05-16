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
    setLoading(true);
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
    fetchBadges();
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
      <div className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-8 text-center text-sm text-white/40 light:text-slate-700">
        Loading badges...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className="block text-xs text-white/40 light:text-slate-700 mb-1">Label</label>
          <Input
            placeholder="Label"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            className="bg-black/40 border-white/[0.08] text-white/90 light:text-slate-700 placeholder:text-white/20"
          />
        </div>
        <div>
          <label className="block text-xs text-white/40 light:text-slate-700 mb-1">Color</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
            />
            <span className="text-xs text-white/40 light:text-slate-700 font-mono">{newColor}</span>
          </div>
        </div>
        <Button onClick={addBadge} className="mb-0.5">Add Badge</Button>
      </div>

      {badges.length === 0 ? (
        <div className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-6 text-center text-sm text-white/40 light:text-slate-700">
          No badges yet.
        </div>
      ) : (
        <ul className="space-y-2">
          {badges.map((badge) => (
            <li
              key={badge.id}
              className="flex items-center justify-between rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2"
            >
              {editingId === badge.id ? (
                <div className="flex items-center gap-2 flex-1">
                  <Input
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    className="w-40 bg-black/40 border-white/[0.08] text-white/90 light:text-slate-700"
                  />
                  <input
                    type="color"
                    value={editColor}
                    onChange={(e) => setEditColor(e.target.value)}
                    data-testid="edit-color"
                    className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
                  />
                  <button
                    onClick={() => saveEdit(badge.id)}
                    className="p-1.5 text-emerald-400 hover:bg-emerald-500/10 rounded transition-colors"
                    title="Save"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="p-1.5 text-white/30 light:text-slate-700 hover:text-white/60 light:hover:text-slate-950 hover:bg-white/[0.04] rounded transition-colors"
                    title="Cancel"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-3 w-3 rounded-full"
                      style={{ backgroundColor: badge.color }}
                    />
                    <span className="text-sm text-white/70 light:text-slate-700">{badge.label}</span>
                    <span className="text-xs text-white/30 light:text-slate-700 font-mono">{badge.color}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => startEdit(badge)}
                      className="p-1.5 text-white/20 light:text-slate-700 hover:text-indigo-400 hover:bg-indigo-500/10 rounded transition-colors"
                      title="Edit"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => deleteBadge(badge.id)}
                      className="p-1.5 text-white/20 light:text-slate-700 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
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
