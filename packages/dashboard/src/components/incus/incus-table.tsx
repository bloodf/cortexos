"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { TechIcon } from "@/components/tech-icon";
import { IncusActionButtons } from "./incus-action-buttons";
import { IncusInstanceDetails } from "./incus-instance-details";
import { IncusCreateDialog } from "./incus-create-dialog";

interface IncusInstance {
  name: string;
  status: string;
  type: string;
  ipv4: string | null;
  ipv6: string | null;
  architecture: string;
  created: string;
  profiles: string[];
  snapshotsCount: number;
}

interface IncusData {
  data: IncusInstance[];
  error?: string;
}

function statusClasses(status: string): string {
  switch (status.toLowerCase()) {
    case "running":
      return "bg-success/10 text-success";
    case "stopped":
      return "bg-destructive/10 text-destructive";
    default:
      return "bg-warning/10 text-warning";
  }
}

function statusVariant(status: string): "default" | "secondary" | "destructive" {
  switch (status.toLowerCase()) {
    case "running":
      return "default";
    case "stopped":
      return "destructive";
    default:
      return "secondary";
  }
}

export function IncusTable() {
  const t = useTranslations("Infrastructure");
  const [data, setData] = useState<IncusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedInstance, setSelectedInstance] = useState<IncusInstance | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetchData = async () => {
      try {
        const res = await fetch("/api/incus", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as IncusData;
        if (mounted) {
          setData(json);
          setError(null);
        }
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : "Failed to fetch");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  async function refreshData() {
    try {
      const res = await fetch("/api/incus", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as IncusData;
      setData(json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch");
    }
  }

  const instances = Array.isArray(data?.data) ? data.data : [];

  const columns: ColumnDef<IncusInstance>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-foreground">{row.original.name}</span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge
          variant={statusVariant(row.original.status)}
          className={statusClasses(row.original.status)}
        >
          {row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => (
        <span className="text-xs text-foreground">{row.original.type}</span>
      ),
    },
    {
      accessorKey: "ipv4",
      header: "IPv4",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-foreground">{row.original.ipv4 || "—"}</span>
      ),
    },
    {
      accessorKey: "architecture",
      header: "Architecture",
      cell: ({ row }) => (
        <span className="text-xs text-foreground">{row.original.architecture}</span>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedInstance(row.original)}
          >
            {t("Details")}
          </Button>
          <IncusActionButtons
            name={row.original.name}
            status={row.original.status}
            onComplete={refreshData}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title={t("IncusTitle")}
        description={t("IncusDescription")}
        icon={<TechIcon name="incus" size={20} />}
        actions={<IncusCreateDialog onCreated={refreshData} />}
      />

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("Instances")}</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={instances}
            loading={loading}
            emptyState={<EmptyState title={t("NoInstances")} />}
          />
        </CardContent>
      </Card>

      {selectedInstance && (
        <IncusInstanceDetails
          name={selectedInstance.name}
          status={selectedInstance.status}
          onClose={() => setSelectedInstance(null)}
        />
      )}
    </div>
  );
}
