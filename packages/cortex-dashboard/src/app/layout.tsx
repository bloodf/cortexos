import type { Metadata } from "next";
import { getLocale, getMessages } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { AlertToastListener } from "@/components/notifications/alert-toast";
import { ThemeProvider } from "@/hooks/use-theme";
import "./globals.css";

export const metadata: Metadata = {
	title: "Cortex Dashboard",
	description: "CortexOS VPS Control Panel",
};

export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const locale = await getLocale();
	const messages = await getMessages();

	return (
		<html
			lang={locale}
			className="dark h-full antialiased"
			suppressHydrationWarning
		>
			<head>
				{/* Prevent flash of wrong theme by reading localStorage before paint */}
				<script
					dangerouslySetInnerHTML={{
						__html: `
							try {
								const t = localStorage.getItem('cortex-theme');
								if (t === 'light' || t === 'dark') {
									document.documentElement.classList.remove('light', 'dark');
									document.documentElement.classList.add(t);
								}
							} catch(e) {}
						`,
					}}
				/>
			</head>
			<body className="min-h-full flex flex-col">
				<NextIntlClientProvider messages={messages}>
					<ThemeProvider>
						<TooltipProvider>{children}</TooltipProvider>
						<Toaster />
						<AlertToastListener />
					</ThemeProvider>
				</NextIntlClientProvider>
			</body>
		</html>
	);
}
