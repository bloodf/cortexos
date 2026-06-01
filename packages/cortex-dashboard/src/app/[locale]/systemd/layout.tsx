import type { Metadata } from "next";
import { DashboardShell } from "@/components/sys-pilot/dashboard-shell";

export const metadata: Metadata = { title: "Systemd" };

export default function SystemdLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return <DashboardShell>{children}</DashboardShell>;
}
