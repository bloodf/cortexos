import { createFileRoute } from "@tanstack/react-router";
import { AdminDockerPage } from "@/features/admin/Docker";
export const Route = createFileRoute("/_authenticated/admin/docker")({
  component: AdminDockerPage,
});
