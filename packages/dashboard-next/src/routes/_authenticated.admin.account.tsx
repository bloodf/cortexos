import { createFileRoute, redirect } from "@tanstack/react-router";

// Account management is removed — this is a single-admin onsite dashboard.
export const Route = createFileRoute("/_authenticated/admin/account")({
  beforeLoad: () => { throw redirect({ to: "/overview" }); },
  component: () => null,
});
