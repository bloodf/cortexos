import type { Metadata } from "next";
import Script from "next/script";
import { cookies } from "next/headers";
import { getLocale, getMessages } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/hooks/useAuth";
import { QueryProvider } from "@/components/query-provider";
import { AlertToastListener } from "@/components/notifications/alert-toast";
import { ThemeProvider } from "@/hooks/use-theme";
import {
	DEFAULT_PRESET,
	PRESET_COOKIE,
	presetClass,
	PRESETS,
	type ThemePreset,
} from "@/lib/theme-presets";
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

	const cookieStore = await cookies();
	const cookiePreset = cookieStore.get(PRESET_COOKIE)?.value;
	const initialPreset: ThemePreset = (PRESETS as readonly string[]).includes(
		cookiePreset ?? "",
	)
		? (cookiePreset as ThemePreset)
		: DEFAULT_PRESET;

	return (
		<html
			lang={locale}
			// `dark` is the next-themes default mode; it manages the light/dark
			// class on the client. The brand preset class is applied SSR from the
			// cookie so there is no flash of the wrong accent.
			className={`dark ${presetClass(initialPreset)} h-full antialiased`}
			suppressHydrationWarning
		>
			<head>
				{/*
					No-flash preset reconciliation: if the cookie changed since the
					SSR render (or differs from the default), swap the theme-* class
					before paint. next-themes handles the light/dark mode itself.
				*/}
				<Script
					id="theme-preset-reconcile"
					strategy="beforeInteractive"
				>{`
					try {
						var m = document.cookie.match(/(?:^|; )${PRESET_COOKIE}=([^;]*)/);
						var p = m ? decodeURIComponent(m[1]) : '${DEFAULT_PRESET}';
						var presets = ${JSON.stringify(PRESETS)};
						if (presets.indexOf(p) === -1) p = '${DEFAULT_PRESET}';
						var el = document.documentElement;
						presets.forEach(function (name) { el.classList.remove('theme-' + name); });
						el.classList.add('theme-' + p);
					} catch (e) {}
				`}</Script>
			</head>
			<body className="min-h-full flex flex-col">
				<NextIntlClientProvider messages={messages}>
					<QueryProvider>
						<ThemeProvider initialPreset={initialPreset}>
							<AuthProvider>
								<TooltipProvider>{children}</TooltipProvider>
							</AuthProvider>
							<Toaster />
							<AlertToastListener />
						</ThemeProvider>
					</QueryProvider>
				</NextIntlClientProvider>
			</body>
		</html>
	);
}
