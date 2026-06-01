import type { Metadata } from "next";
import { PageHeader } from "@/components/sys-pilot/PageHeader";
import { Boxes } from "lucide-react";
import { ProvisionWizard } from "@/components/sys-pilot/incus/provision-wizard";

export const metadata: Metadata = { title: "Provision Instance" };

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
