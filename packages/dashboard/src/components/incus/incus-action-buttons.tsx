"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface IncusActionButtonsProps {
  name: string;
  status: string;
  onComplete?: () => void;
}

export function IncusActionButtons({ name, status, onComplete }: IncusActionButtonsProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isRunning = status.toLowerCase() === "running";

  async function handleAction(action: string) {
    setLoading(action);
    setError(null);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (action === "delete") {
        headers["x-incus-delete-confirm"] = "true";
      }
      const res = await fetch("/api/incus/actions", {
        method: "POST",
        headers,
        body: JSON.stringify({ action, name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Action failed");
      } else {
        setConfirmDelete(false);
        onComplete?.();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {isRunning ? (
        <>
          <Button
            size="sm"
            variant="outline"
            disabled={loading !== null}
            onClick={() => handleAction("stop")}
          >
            {loading === "stop" ? "…" : "Stop"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={loading !== null}
            onClick={() => handleAction("restart")}
          >
            {loading === "restart" ? "…" : "Restart"}
          </Button>
        </>
      ) : (
        <Button
          size="sm"
          variant="outline"
          disabled={loading !== null}
          onClick={() => handleAction("start")}
        >
          {loading === "start" ? "…" : "Start"}
        </Button>
      )}
      {confirmDelete ? (
        <>
          <Button
            size="sm"
            variant="destructive"
            disabled={loading !== null}
            onClick={() => handleAction("delete")}
          >
            {loading === "delete" ? "…" : "Confirm"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={loading !== null}
            onClick={() => setConfirmDelete(false)}
          >
            Cancel
          </Button>
        </>
      ) : (
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive hover:text-destructive"
          disabled={loading !== null}
          onClick={() => setConfirmDelete(true)}
        >
          Delete
        </Button>
      )}
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
