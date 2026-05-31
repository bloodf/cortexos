import { DashboardShell } from "@/components/sys-pilot/dashboard-shell";

export default function SystemdLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return <DashboardShell>{children}</DashboardShell>;
}
