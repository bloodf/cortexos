import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { ThemeSettings } from "@/components/ui/theme-switcher";

export default function SettingsPage() {
	return (
		<div className="space-y-4">
			<h1 className="text-2xl font-semibold">Settings</h1>
			<Card>
				<CardHeader>
					<CardTitle>Appearance</CardTitle>
					<CardDescription>
						Choose a light, dark, or system mode and a brand accent.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<ThemeSettings />
				</CardContent>
			</Card>
		</div>
	);
}
