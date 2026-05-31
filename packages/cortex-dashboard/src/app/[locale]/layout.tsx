import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { CommandPalette } from "@/components/command-palette";
import { FavoritesBar } from "@/components/favorites-bar";
import { DashboardDataProvider } from "@/hooks/dashboard-data-context";
import { AppShell } from "@/app/sys-pilot/AppShell";

export const metadata: Metadata = {
	title: "Cortex Dashboard",
	description: "CortexOS VPS Control Panel",
	manifest: "/manifest.json",
	appleWebApp: {
		capable: true,
		title: "Cortex Dashboard",
		statusBarStyle: "black-translucent",
	},
};

export default async function LocaleLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const messages = await getMessages();

	return (
		<NextIntlClientProvider messages={messages}>
			<DashboardDataProvider>
				<AppShell>
					<CommandPalette />
					<FavoritesBar />
					{children}
				</AppShell>
			</DashboardDataProvider>
		</NextIntlClientProvider>
	);
}
