import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    try {
      const u = JSON.parse(localStorage.getItem("cortex.auth") || "null");
      if (!u?.is_admin) {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw redirect({ to: "/overview" });
      }
    } catch (e: unknown) {
      const err = e as { isRedirect?: unknown; message?: string };
      if (err.isRedirect) {
        throw e;
      }
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw redirect({ to: "/login" });
    }
  },
  component: () => <Outlet />,
});
