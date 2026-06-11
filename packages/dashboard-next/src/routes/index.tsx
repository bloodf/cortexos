import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    if (typeof window === "undefined") {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw redirect({ to: "/overview" });
    }
    const authed = !!localStorage.getItem("cortex.auth");
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw redirect({ to: authed ? "/overview" : "/login" });
  },
  component: () => null,
});
