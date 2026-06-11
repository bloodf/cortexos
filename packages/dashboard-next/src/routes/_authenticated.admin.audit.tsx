import { createFileRoute } from "@tanstack/react-router";
import { AdminAuditPage } from "@/features/admin/Audit";

export const Route = createFileRoute("/_authenticated/admin/audit")({ component: AdminAuditPage });
