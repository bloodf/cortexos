import { createFileRoute, redirect } from "@tanstack/react-router";

// Account management is removed — this is a single-admin onsite dashboard.
export const Route = createFileRoute("/_authenticated/admin/account")({
  beforeLoad: () => {
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw redirect({ to: "/overview" });
  },
  component: () => null,
});
