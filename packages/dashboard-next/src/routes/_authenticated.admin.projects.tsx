import { createFileRoute, redirect } from "@tanstack/react-router";

// Projects are now part of Incus instances — each project owns one instance.
export const Route = createFileRoute("/_authenticated/admin/projects")({
  beforeLoad: () => {
    throw redirect({ to: "/incus" });
  },
  component: () => null,
});
