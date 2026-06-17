import { createFileRoute } from "@tanstack/react-router";
import { HeadroomPage } from "@/features/Headroom";
import { api } from "@/lib/api/client";

export const Route = createFileRoute("/_authenticated/headroom")({
  loader: async () => {
    const [health, stats, url] = await Promise.all([
      api.headroomHealth(),
      api.headroomStats(),
      api.headroomUrl(),
    ]);
    return { health, stats, url };
  },
  component: HeadroomPage,
});
