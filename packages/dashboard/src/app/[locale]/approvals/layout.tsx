import type { Metadata } from "next";
import { DashboardShell } from "@/components/sys-pilot/dashboard-shell";

export const metadata: Metadata = { title: "Approvals" };

export default function Layout({ children }: { children: React.ReactNode }) {
	return <DashboardShell>{children}</DashboardShell>;
}
