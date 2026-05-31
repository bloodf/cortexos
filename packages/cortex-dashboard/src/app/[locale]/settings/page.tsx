import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/sys-pilot/PageHeader";
import { SettingsIcon } from "lucide-react";

export default function SettingsPage() {
	return (
		<div className="flex flex-col gap-6 p-6">
			<PageHeader
				title="Settings"
				description="Personalize the dashboard appearance and workspace preferences."
				icon={<SettingsIcon className="size-5" />}
				actions={undefined}
			/>
			<Card>
				<CardHeader>
					<CardTitle>Appearance</CardTitle>
					<CardDescription>
						Choose a light, dark, or system mode and a brand accent.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<p className="text-sm text-muted-foreground">Theme settings coming soon.</p>
				</CardContent>
			</Card>
		</div>
	);
}
