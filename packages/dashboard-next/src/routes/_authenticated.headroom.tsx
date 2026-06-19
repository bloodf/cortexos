import { createFileRoute } from "@tanstack/react-router";
import { HeadroomPage } from "@/features/Headroom";
import { api } from "@/lib/api/client";

export const Route = createFileRoute("/_authenticated/headroom")({
  loader: async () => {
    // Degrace: allSettled so one failing RPC doesn't block the whole route —
    // the page's useQuery will refetch/retry and the EmptyState will show.
    const results = await Promise.allSettled([
      api.headroomHealth(),
      api.headroomStats(),
      api.headroomUrl(),
    ]);
    return {
      health: results[0].status === "fulfilled" ? results[0].value : undefined,
      stats: results[1].status === "fulfilled" ? results[1].value : undefined,
      url: results[2].status === "fulfilled" ? results[2].value : undefined,
    };
  },
  component: HeadroomPage,
});
