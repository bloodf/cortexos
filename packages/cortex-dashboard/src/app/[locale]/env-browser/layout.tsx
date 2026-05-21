import { DashboardShell } from "@/components/dashboard-shell";

export default function EnvBrowserLayout({ children }: { children: React.ReactNode }) {
	return <DashboardShell>{children}</DashboardShell>;
}
