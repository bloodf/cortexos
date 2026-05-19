import { DashboardShell } from "@/components/dashboard-shell";

export default function SystemdLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return <DashboardShell>{children}</DashboardShell>;
}
