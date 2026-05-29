"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { RefreshCwIcon } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { TechIcon } from "@/components/tech-icon";
import { DockerActionButtons } from "./action-buttons";

interface CliContainer {
  ID: string;
  Names: string;
  Image: string;
  Command: string;
  CreatedAt: string;
  Ports: string;
  State: string;
  Status: string;
  Networks: string;
  Size: string;
}

interface CliVolume {
  Name: string;
  Driver: string;
  Mountpoint: string;
  Scope: string;
  Labels: string;
}

interface CliImage {
  ID: string;
  Repository: string;
  Tag: string;
  Size: string;
  CreatedSince: string;
}

interface DockerResult<T> {
  data: T[];
  error?: string;
}

interface DockerData {
  containers: DockerResult<CliContainer>;
  volumes: DockerResult<CliVolume>;
  images: DockerResult<CliImage>;
}

function stateVariant(state: string): "default" | "secondary" | "destructive" {
  switch (state) {
    case "running":
      return "default";
    case "paused":
      return "secondary";
    default:
      return "destructive";
  }
}

function stateClasses(state: string): string {
  switch (state) {
    case "running":
      return "bg-success/10 text-success";
    case "paused":
      return "bg-warning/10 text-warning";
    default:
      return "bg-destructive/10 text-destructive";
  }
}

export function DockerTable() {
  const t = useTranslations("Infrastructure");
  const [data, setData] = useState<DockerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetchData = async () => {
      try {
        const res = await fetch("/api/docker", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as DockerData;
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
      const res = await fetch("/api/docker", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as DockerData;
      setData(json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch");
    }
  }

  const containers = Array.isArray(data?.containers?.data) ? data.containers.data : [];
  const volumes = Array.isArray(data?.volumes?.data) ? data.volumes.data : [];
  const images = Array.isArray(data?.images?.data) ? data.images.data : [];

  const containerColumns: ColumnDef<CliContainer>[] = [
    {
      accessorKey: "Names",
      header: "Name",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-foreground">{row.original.Names}</span>
      ),
    },
    {
      accessorKey: "State",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={stateVariant(row.original.State)} className={stateClasses(row.original.State)}>
          {row.original.Status}
        </Badge>
      ),
    },
    {
      accessorKey: "Image",
      header: "Image",
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">{row.original.Image}</span>
      ),
    },
    {
      accessorKey: "Ports",
      header: "Ports",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">{row.original.Ports || "—"}</span>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      enableSorting: false,
      cell: ({ row }) => (
        <DockerActionButtons name={row.original.Names} onComplete={refreshData} />
      ),
    },
  ];

  const volumeColumns: ColumnDef<CliVolume>[] = [
    {
      accessorKey: "Name",
      header: "Name",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-foreground">{row.original.Name}</span>
      ),
    },
    {
      accessorKey: "Driver",
      header: "Driver",
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">{row.original.Driver}</span>
      ),
    },
    {
      accessorKey: "Mountpoint",
      header: "Mountpoint",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground truncate block max-w-[300px]">
          {row.original.Mountpoint}
        </span>
      ),
    },
  ];

  const imageColumns: ColumnDef<CliImage>[] = [
    {
      accessorKey: "Repository",
      header: "Repository",
      cell: ({ row }) => (
        <span className="text-xs text-foreground">{row.original.Repository}</span>
      ),
    },
    {
      accessorKey: "Tag",
      header: "Tag",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">{row.original.Tag}</span>
      ),
    },
    {
      accessorKey: "Size",
      header: "Size",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">{row.original.Size}</span>
      ),
    },
    {
      accessorKey: "CreatedSince",
      header: "Created",
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">{row.original.CreatedSince}</span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title={t("DockerTitle")}
        description={t("DockerDescription")}
        icon={<TechIcon name="docker" size={20} />}
        actions={
          <Button variant="outline" size="sm" onClick={refreshData}>
            <RefreshCwIcon />
            Refresh
          </Button>
        }
      />

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("Containers")}</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={containerColumns}
            data={containers}
            loading={loading}
            emptyState={<EmptyState title={t("NoContainers")} />}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("Volumes")}</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={volumeColumns}
            data={volumes}
            loading={loading}
            emptyState={<EmptyState title={t("NoVolumes")} />}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("Images")}</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={imageColumns}
            data={images}
            loading={loading}
            emptyState={<EmptyState title={t("NoImages")} />}
          />
        </CardContent>
      </Card>
    </div>
  );
}
