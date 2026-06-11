import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    if (typeof window === "undefined") {
      throw redirect({ to: "/overview" });
    }
    const authed = !!localStorage.getItem("cortex.auth");
    throw redirect({ to: authed ? "/overview" : "/login" });
  },
  component: () => null,
});
