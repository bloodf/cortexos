import { AdminDockerPanel } from "@/components/admin/admin-docker-panel";
import { PageHeader } from "@/components/ui/page-header";
import { Container } from "lucide-react";

export default function AdminDockerPage() {
	return (
		<div className="flex flex-col gap-6 p-6">
			<PageHeader
				title="Docker"
				description="Container, image, volume, and network management. Prune actions require explicit confirmation."
				icon={<Container />}
			/>
			<AdminDockerPanel />
		</div>
	);
}

export const dynamic = "force-dynamic";
