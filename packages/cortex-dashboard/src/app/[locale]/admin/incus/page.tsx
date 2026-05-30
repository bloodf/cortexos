import { PageHeader } from "@/components/ui/page-header";
import { Boxes } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { IncusSettingsForm } from "@/components/admin/incus-settings-form";

export default function AdminIncusPage() {
	return (
		<div className="flex flex-col gap-6 p-6">
			<PageHeader
				title="Incus wizard settings"
				description="Global defaults for the Incus provisioning wizard and the AI model used for assist."
				icon={<Boxes />}
			/>
			<Card>
				<CardHeader>
					<CardTitle>Defaults & AI model</CardTitle>
					<CardDescription>
						These defaults pre-fill the wizard. The AI model (served via 9router) is used for
						optional repo analysis and validation; the wizard works without it.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<IncusSettingsForm />
				</CardContent>
			</Card>
		</div>
	);
}
