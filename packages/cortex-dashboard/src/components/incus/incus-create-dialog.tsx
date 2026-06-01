"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface IncusImage {
  fingerprint: string;
  aliases: string[];
  architecture: string;
  size: number;
  created: string;
  type: string;
}

interface IncusCreateDialogProps {
  onCreated?: () => void;
}

const SAFE_NAME_RE = /^[a-zA-Z][a-zA-Z0-9_-]{0,62}$/;

export function IncusCreateDialog({ onCreated }: IncusCreateDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [images, setImages] = useState<IncusImage[]>([]);
  const [selectedImage, setSelectedImage] = useState("");
  const [profiles, setProfiles] = useState("default");
  const [loading, setLoading] = useState(false);
  const [fetchingImages, setFetchingImages] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFetchingImages(true);
    fetch("/api/incus/images", { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => {
        if (Array.isArray(json.data)) {
          setImages(json.data);
          if (json.data.length > 0) {
            const alias = json.data[0].aliases[0] || json.data[0].fingerprint;
            setSelectedImage(alias);
          }
        }
      })
      .catch(() => {})
      .finally(() => setFetchingImages(false));
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!SAFE_NAME_RE.test(name)) {
      setError("Name must start with a letter and contain only alphanumeric, hyphen, or underscore.");
      return;
    }
    if (!selectedImage) {
      setError("Please select an image.");
      return;
    }

    setLoading(true);
    try {
      const profileList = profiles
        .split(",")
        .map((p) => p.trim())
        .filter((p) => p.length > 0);
      const res = await fetch("/api/incus/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, image: selectedImage, profiles: profileList }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Create failed");
      } else {
        setOpen(false);
        setName("");
        setSelectedImage("");
        setProfiles("default");
        onCreated?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        + Create
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Instance</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my-instance"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Image</label>
            {fetchingImages ? (
              <p className="text-xs text-muted-foreground">Loading images...</p>
            ) : (
              <select
                value={selectedImage}
                onChange={(e) => setSelectedImage(e.target.value)}
                className="w-full text-sm bg-secondary border border-border rounded-md px-3 py-2 text-foreground"
              >
                {images.map((img) => {
                  const label = img.aliases[0] || img.fingerprint.slice(0, 12);
                  return (
                    <option key={img.fingerprint} value={label}>
                      {label} ({img.architecture})
                    </option>
                  );
                })}
              </select>
            )}
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Profiles (comma-separated)</label>
            <Input
              value={profiles}
              onChange={(e) => setProfiles(e.target.value)}
              placeholder="default"
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create"}
            </Button>
          </div>
        </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
