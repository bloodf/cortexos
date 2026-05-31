import { DashboardShell } from "@/components/sys-pilot/dashboard-shell";

export default function AlertsLayout({ children }: { children: React.ReactNode }) {
	return <DashboardShell>{children}</DashboardShell>;
}
