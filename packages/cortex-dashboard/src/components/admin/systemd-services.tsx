"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface SystemdService {
  name: string;
  load: string;
  active: string;
  sub: string;
  description: string;
}

export function SystemdServices() {
  const [services, setServices] = useState<SystemdService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  async function fetchServices() {
    try {
      const res = await fetch("/api/systemd", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setServices(data.services ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch systemd services");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/systemd", { cache: "no-store" });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        setServices(data.services ?? []);
        setError(null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to fetch systemd services");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function runAction(name: string, action: string) {
    setActionLoading(`${name}:${action}`);
    setError(null);
    try {
      const res = await fetch("/api/systemd/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      await fetchServices();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading systemd services...</div>;
  }

  if (error && services.length === 0) {
    return <div className="text-sm text-destructive">{error}</div>;
  }

  return (
    <div className="space-y-3">
      {error && <div className="text-sm text-destructive">{error}</div>}
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs font-medium text-muted-foreground">Name</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground">State</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground">Description</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {services.map((service) => (
              <TableRow key={service.name}>
                <TableCell className="font-mono text-sm text-foreground">{service.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{service.active}/{service.sub}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{service.description}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    {["start", "stop", "restart"].map((action) => (
                      <Button
                        key={action}
                        size="sm"
                        variant="outline"
                        disabled={actionLoading !== null}
                        onClick={() => runAction(service.name, action)}
                      >
                        {actionLoading === `${service.name}:${action}` ? "..." : action.charAt(0).toUpperCase() + action.slice(1)}
                      </Button>
                    ))}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
