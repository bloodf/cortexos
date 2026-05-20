"use client";

import { useEffect, useState, useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { SkeletonTable } from "@/components/skeleton";
import { DockerActionButtons } from "./action-buttons";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

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

export function DockerTable() {
  const [data, setData] = useState<DockerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [containersFilter, setContainersFilter] = useState("");
  const [volumesFilter, setVolumesFilter] = useState("");
  const [imagesFilter, setImagesFilter] = useState("");

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

  const containerColumns = useMemo<ColumnDef<CliContainer>[]>(
    () => [
      {
        accessorKey: "Names",
        header: "Name",
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.Names}</span>
        ),
      },
      {
        accessorKey: "Status",
        header: "Status",
        cell: ({ row }) => {
          const c = row.original;
          return (
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                c.State === "running"
                  ? "bg-emerald-500/10 text-emerald-400"
                  : c.State === "paused"
                  ? "bg-amber-500/10 text-amber-400"
                  : "bg-red-500/10 text-red-400"
              }`}
            >
              {c.Status}
            </span>
          );
        },
      },
      {
        accessorKey: "Image",
        header: "Image",
        cell: ({ row }) => (
          <span className="text-xs">{row.original.Image}</span>
        ),
      },
      {
        accessorKey: "Ports",
        header: "Ports",
        cell: ({ row }) => (
          <span className="text-xs font-mono">{row.original.Ports || "—"}</span>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <DockerActionButtons name={row.original.Names} onComplete={refreshData} />
        ),
      },
    ],
    []
  );

  const volumeColumns = useMemo<ColumnDef<CliVolume>[]>(
    () => [
      {
        accessorKey: "Name",
        header: "Name",
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.Name}</span>
        ),
      },
      {
        accessorKey: "Driver",
        header: "Driver",
        cell: ({ row }) => <span className="text-xs">{row.original.Driver}</span>,
      },
      {
        accessorKey: "Mountpoint",
        header: "Mountpoint",
        cell: ({ row }) => (
          <span className="text-xs font-mono truncate max-w-[300px] block">
            {row.original.Mountpoint}
          </span>
        ),
      },
    ],
    []
  );

  const imageColumns = useMemo<ColumnDef<CliImage>[]>(
    () => [
      {
        accessorKey: "Repository",
        header: "Repository",
        cell: ({ row }) => <span className="text-xs">{row.original.Repository}</span>,
      },
      {
        accessorKey: "Tag",
        header: "Tag",
        cell: ({ row }) => (
          <span className="text-xs font-mono">{row.original.Tag}</span>
        ),
      },
      {
        accessorKey: "Size",
        header: "Size",
        cell: ({ row }) => (
          <span className="text-xs font-mono">{row.original.Size}</span>
        ),
      },
      {
        accessorKey: "CreatedSince",
        header: "Created",
        cell: ({ row }) => <span className="text-xs">{row.original.CreatedSince}</span>,
      },
    ],
    []
  );

  if (loading) {
    return (
      <div className="space-y-6 animate-[slide-in_0.4s_ease-out]">
        <SkeletonTable rows={5} cols={4} />
      </div>
    );
  }

  if (error) {
    return <div className="text-sm text-red-400">{error}</div>;
  }

  return (
    <div className="animate-[slide-in_0.4s_ease-out]">
      <Tabs defaultValue="containers">
        <TabsList variant="line" className="mb-4">
          <TabsTrigger value="containers">
            Containers ({containers.length})
          </TabsTrigger>
          <TabsTrigger value="images">
            Images ({images.length})
          </TabsTrigger>
          <TabsTrigger value="volumes">
            Volumes ({volumes.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="containers">
          <DataTable
            columns={containerColumns}
            data={containers}
            searchPlaceholder="Search containers…"
            globalFilter={containersFilter}
            onGlobalFilterChange={setContainersFilter}
            noPagination
          />
        </TabsContent>

        <TabsContent value="images">
          <DataTable
            columns={imageColumns}
            data={images}
            searchPlaceholder="Search images…"
            globalFilter={imagesFilter}
            onGlobalFilterChange={setImagesFilter}
            noPagination
          />
        </TabsContent>

        <TabsContent value="volumes">
          <DataTable
            columns={volumeColumns}
            data={volumes}
            searchPlaceholder="Search volumes…"
            globalFilter={volumesFilter}
            onGlobalFilterChange={setVolumesFilter}
            noPagination
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
