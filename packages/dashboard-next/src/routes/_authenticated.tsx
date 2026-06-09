import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppShell } from "@/app/AppShell";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: ({ location }) => {
    // Client-only auth check via localStorage (mock); SSR-safe.
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem("cortex.auth");
    if (!raw) throw redirect({ to: "/login", search: { redirect: location.href } });
  },
  component: () => <AppShell><Outlet /></AppShell>,
});
