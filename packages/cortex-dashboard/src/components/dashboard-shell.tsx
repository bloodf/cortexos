"use client";

// Top-level dashboard shell. Composes sidebar + topbar + persistent cortex
// chat panel. See `src/components/layout/app-shell.tsx` for the v1.0 layout.
//
// Previously this file owned the layout directly; the v1.0 plan introduces
// drawer-style navigation + right-rail chat panel, so we delegate to
// `AppShell` and keep this name to avoid churning every segment layout.

import { AppShell } from "@/components/layout/app-shell";

export function DashboardShell({ children }: { children: React.ReactNode }) {
	return <AppShell>{children}</AppShell>;
}
