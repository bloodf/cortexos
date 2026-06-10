import { createFileRoute } from "@tanstack/react-router";
import { AdminSystemdPage } from "@/features/admin/Systemd";
export const Route = createFileRoute("/_authenticated/admin/systemd")({
  component: AdminSystemdPage,
});
