"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { Play, Square, RotateCw, Server, ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/sys-pilot/PageHeader";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function SystemdDetailPage() {
  const qc = useQueryClient();
  const params = useParams();
  const { user } = useAuth();
  const isAdmin = !!user?.is_admin;

  const unitName = decodeURIComponent(
    Array.isArray(params.unit) ? params.unit[0] : (params.unit ?? ""),
  );

  const { data: units = [], isLoading } = useQuery({ queryKey: ["systemd"], queryFn: api.systemd });
  const unit = units.find((u) => u.name === unitName);

  const runAction = async (action: "start" | "stop" | "restart") => {
    try {
      const res = await fetch("/api/systemd/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, name: unitName }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Failed to ${action} ${unitName}`);
      }
      toast.success(`${action.charAt(0).toUpperCase() + action.slice(1)}ed ${unitName}`);
      qc.invalidateQueries({ queryKey: ["systemd"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `Failed to ${action} ${unitName}`);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Server className="size-5" />}
        title={unitName || "Systemd Detail"}
        description={unit?.description || "Detailed view."}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/systemd" className={cn(buttonVariants({ size: "sm", variant: "ghost" }))}>
              <ArrowLeft className="size-3.5 mr-1" />Back
            </Link>
            {unit && unit.active !== "active" ? (
              <Button size="sm" variant="outline" disabled={!isAdmin} onClick={() => runAction("start")}><Play className="size-3.5 mr-1" />Start</Button>
            ) : (
              <Button size="sm" variant="outline" disabled={!isAdmin} onClick={() => runAction("stop")}><Square className="size-3.5 mr-1" />Stop</Button>
            )}
            <Button size="sm" variant="outline" disabled={!isAdmin} onClick={() => runAction("restart")}><RotateCw className="size-3.5 mr-1" />Restart</Button>
          </div>
        }
      />

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : !unit ? (
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
          Unit <span className="font-mono">{unitName}</span> not found.
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="font-mono text-base">{unit.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
              <Detail label="Description">
                <span className="text-sm">{unit.description || "—"}</span>
              </Detail>
              <Detail label="Load">
                <Badge variant="outline">{unit.load}</Badge>
              </Detail>
              <Detail label="Active">
                <Badge
                  variant="outline"
                  className={cn(
                    unit.active === "active" && "border-[var(--success)] text-[var(--success)]",
                    unit.active === "failed" && "border-[var(--destructive)] text-[var(--destructive)]",
                  )}
                >
                  {unit.active}
                </Badge>
              </Detail>
              <Detail label="Sub">
                <span className="text-sm text-muted-foreground">{unit.sub}</span>
              </Detail>
              <Detail label="Enabled">
                <Badge variant="outline">{unit.enabled ? "enabled" : "disabled"}</Badge>
              </Detail>
            </dl>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
