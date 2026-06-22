import { createFileRoute, Outlet } from "@tanstack/react-router";

// Layout route: renders child routes (index = list, /new = generator) into the
// Outlet. Without this Outlet, /agents/new could not mount and fell back to the
// list. The list itself lives in _authenticated.agents.index.tsx.
export const Route = createFileRoute("/_authenticated/agents")({
  component: () => <Outlet />,
});
