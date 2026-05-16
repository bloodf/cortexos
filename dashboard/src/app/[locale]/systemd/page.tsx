import { SystemdServices } from "@/components/admin/systemd-services";

export default function SystemdPage() {
	return (
		<div className="space-y-4">
			<h1 className="text-2xl font-semibold">Systemd</h1>
			<p className="text-sm text-muted-foreground">
				Read-only view of host systemd units. Use Admin · Systemd to start/stop/restart.
			</p>
			<SystemdServices />
		</div>
	);
}

export const dynamic = "force-dynamic";
