import { AdminDockerPanel } from "@/components/admin/admin-docker-panel";

export default function DockerPage() {
	return (
		<div className="space-y-4">
			<h1 className="text-2xl font-semibold">Docker</h1>
			<p className="text-sm text-muted-foreground">
				Container, image, volume, and network management. Prune actions require explicit confirmation.
			</p>
			<AdminDockerPanel />
		</div>
	);
}

export const dynamic = "force-dynamic";
