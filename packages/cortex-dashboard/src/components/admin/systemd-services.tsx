"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
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
    return <div className="text-sm text-white/40 light:text-slate-700">Loading systemd services...</div>;
  }

  if (error && services.length === 0) {
    return <div className="text-sm text-red-400">{error}</div>;
  }

  return (
    <div className="space-y-3">
      {error && <div className="text-sm text-red-400">{error}</div>}
      <div className="rounded-lg border border-white/[0.04] bg-white/[0.02] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-white/[0.04] hover:bg-transparent">
              <TableHead className="text-white/40 light:text-slate-700 text-xs font-medium">Name</TableHead>
              <TableHead className="text-white/40 light:text-slate-700 text-xs font-medium">State</TableHead>
              <TableHead className="text-white/40 light:text-slate-700 text-xs font-medium">Description</TableHead>
              <TableHead className="text-white/40 light:text-slate-700 text-xs font-medium">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {services.map((service) => (
              <TableRow key={service.name} className="border-b border-white/[0.02] hover:bg-white/[0.02]">
                <TableCell className="text-white/70 light:text-slate-700 text-sm font-mono">{service.name}</TableCell>
                <TableCell className="text-white/40 light:text-slate-700 text-sm">{service.active}/{service.sub}</TableCell>
                <TableCell className="text-white/40 light:text-slate-700 text-sm">{service.description}</TableCell>
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
