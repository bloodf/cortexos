import { DashboardShell } from "@/components/dashboard-shell";

export default function BadgesLayout({ children }: { children: React.ReactNode }) {
	return <DashboardShell>{children}</DashboardShell>;
}
