import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Services" };

// Renamed to /healthcheck per v1.0 plan §3.
export default async function ServicesPage({
	params,
}: Readonly<{
	params: Promise<{ locale: string }>;
}>) {
	const { locale } = await params;
	redirect(`/${locale}/healthcheck`);
}
