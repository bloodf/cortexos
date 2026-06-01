"use client";

import { useState } from "react";
import useSWR from "swr";
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

const fetcher = (url: string) => fetch(url, { cache: "no-store" }).then((r) => r.json());

export function SystemdServices() {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, error: fetchError, isLoading, mutate } = useSWR<{ services: SystemdService[]; error?: string }>(
    "/api/systemd",
    fetcher,
  );
  const services = data?.services ?? [];
  const error = fetchError?.message ?? data?.error ?? actionError;

  async function runAction(name: string, action: string) {
    setActionLoading(`${name}:${action}`);
    setActionError(null);
    try {
      const res = await fetch("/api/systemd/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      await mutate();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setActionLoading(null);
    }
  }

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading systemd services…</div>;
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
                        {actionLoading === `${service.name}:${action}` ? "…" : action.charAt(0).toUpperCase() + action.slice(1)}
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
