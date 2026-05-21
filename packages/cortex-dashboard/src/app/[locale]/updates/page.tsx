import { PackageUpdatesPanel } from "@/components/admin/package-updates-panel";

export default function UpdatesPage() {
	return (
		<div className="space-y-4">
			<div>
				<h1 className="text-2xl font-semibold">Updates</h1>
				<p className="text-sm text-muted-foreground">
					Review available host package updates, apply them, and optionally restart the affected systemd service.
				</p>
			</div>
			<PackageUpdatesPanel />
		</div>
	);
}

export const dynamic = "force-dynamic";
