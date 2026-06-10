import { createFileRoute } from "@tanstack/react-router";
import { AdminIncusPage } from "@/features/admin/Incus";
export const Route = createFileRoute("/_authenticated/admin/incus")({ component: AdminIncusPage });
