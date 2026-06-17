import { useQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { Activity, ExternalLink, Gauge, Save, TrendingDown, Zap } from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { MetricCard } from "@/components/MetricCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { api } from "@/lib/api/client";
import { useT } from "@/hooks/useT";

const routeApi = getRouteApi("/_authenticated/headroom");

function formatNumber(n: number | undefined): string {
  if (n === undefined || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US").format(n);
}

function formatUsd(n: number | undefined): string {
  if (n === undefined || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function formatPct(n: number | undefined): string {
  if (n === undefined || Number.isNaN(n)) return "—";
  return `${n.toFixed(2)}%`;
}

export function HeadroomPage() {
  const t = useT();
  const { health: initialHealth, stats: initialStats, url: initialUrl } = routeApi.useLoaderData();

  const { data: health, isLoading: healthLoading, isError: healthError } = useQuery({
    queryKey: ["headroom", "health"],
    queryFn: api.headroomHealth,
    initialData: initialHealth,
    refetchInterval: 30_000,
  });
  const { data: stats, isLoading: statsLoading, isError: statsError } = useQuery({
    queryKey: ["headroom", "stats"],
    queryFn: api.headroomStats,
    initialData: initialStats,
    refetchInterval: 30_000,
  });
  const { data: headroomUrl } = useQuery({
    queryKey: ["headroom", "url"],
    queryFn: api.headroomUrl,
    initialData: initialUrl,
    staleTime: Infinity,
  });

  const isLoading = healthLoading || statsLoading;
  const isError = healthError || statsError;

  const status: "online" | "offline" | "unknown" =
    healthError || statsError ? "offline" : health?.status === "healthy" ? "online" : "unknown";

  const summary = stats?.summary;
  const savings = stats?.savings;

  return (
    <div className="space-y-5">
      <PageHeader
        icon={<Activity className="size-5" />}
        title="Headroom"
        description="Context compression metrics and proxy health for AI agents."
      />

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {isLoading ? (
            <span className="text-sm text-muted-foreground">{t.common.loading}</span>
          ) : (
            <StatusBadge status={status} />
          )}
          {health?.version && (
            <span className="text-xs text-muted-foreground font-mono">v{health.version}</span>
          )}
        </div>
        <Button variant="outline" size="sm" asChild>
          <a
            href={headroomUrl ?? "http://127.0.0.1:8787/dashboard"}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5"
          >
            Open Headroom UI <ExternalLink className="size-3.5" />
          </a>
        </Button>
      </div>

      {isError && (
        <EmptyState
          icon={<Activity className="size-6" />}
          title="Headroom unavailable"
          description="Could not reach the Headroom proxy on 127.0.0.1:8787. Make sure headroom-default.service is running."
        />
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          icon={<Zap className="size-4" />}
          label="API requests"
          value={formatNumber(summary?.api_requests)}
          hint={summary?.primary_model ? `Model: ${summary.primary_model}` : undefined}
        />
        <MetricCard
          icon={<TrendingDown className="size-4" />}
          label="Tokens saved"
          value={formatNumber(savings?.total_tokens)}
          hint={summary?.compression?.avg_compression_pct
            ? `Avg compression ${formatPct(summary.compression.avg_compression_pct)}`
            : undefined}
        />
        <MetricCard
          icon={<Save className="size-4" />}
          label="Estimated savings"
          value={formatUsd(summary?.cost?.total_saved_usd)}
          hint={summary?.cost?.savings_pct
            ? `Savings ratio ${formatPct(summary.cost.savings_pct)}`
            : undefined}
        />
        <MetricCard
          icon={<Gauge className="size-4" />}
          label="Mode"
          value={summary?.mode ?? "—"}
          hint="Compression strategy"
        />
      </div>

      {savings?.per_project && Object.keys(savings.per_project).length > 0 && (
        <div className="rounded-lg border border-border/60 bg-card p-4">
          <h3 className="text-sm font-medium mb-3">Per-project savings</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(savings.per_project).map(([project, p]) => (
              <div
                key={project}
                className="rounded-md border border-border/40 bg-background p-3 space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium truncate">{project}</span>
                  <span className="text-xs text-muted-foreground font-mono">
                    {formatNumber(p.tokens_saved)} tokens
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatUsd(p.compression_savings_usd)} saved ·{" "}
                  {formatPct(p.savings_percent)} compression
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatNumber(p.requests)} requests
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
