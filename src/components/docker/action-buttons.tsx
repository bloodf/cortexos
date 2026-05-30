"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface DockerActionButtonsProps {
  name: string;
  actions?: string[];
  onComplete?: () => void;
}

export function DockerActionButtons({
  name,
  actions = ["start", "stop", "restart"],
  onComplete,
}: DockerActionButtonsProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAction(action: string) {
    setLoading(action);
    setError(null);
    try {
      const res = await fetch("/api/docker/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Action failed");
      } else {
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
      {actions.map((action) => (
        <Button
          key={action}
          size="sm"
          variant="outline"
          disabled={loading !== null}
          onClick={() => handleAction(action)}
        >
          {loading === action ? "..." : action.charAt(0).toUpperCase() + action.slice(1)}
        </Button>
      ))}
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}
