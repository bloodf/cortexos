import { DashboardShell } from "@/components/dashboard-shell";

export default function AgentFactoryLayout({ children }: { children: React.ReactNode }) {
	return <DashboardShell>{children}</DashboardShell>;
}
