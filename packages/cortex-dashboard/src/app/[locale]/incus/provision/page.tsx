import { PageHeader } from "@/components/ui/page-header";
import { Boxes } from "lucide-react";
import { ProvisionWizard } from "@/components/incus/provision-wizard";

export default function IncusProvisionPage() {
	return (
		<div className="flex flex-col gap-6 p-6">
			<PageHeader
				title="Provision project instance"
				description="Create a CortexOS Incus project-instance: launch, clone, Hermes profile, proxies, and Tailscale."
				icon={<Boxes />}
			/>
			<ProvisionWizard />
		</div>
	);
}
