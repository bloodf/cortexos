import { createFileRoute, redirect } from "@tanstack/react-router";

// Projects are now part of Incus instances — each project owns one instance.
export const Route = createFileRoute("/_authenticated/admin/projects")({
  beforeLoad: () => {
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw redirect({ to: "/admin/incus" });
  },
  component: () => null,
});
