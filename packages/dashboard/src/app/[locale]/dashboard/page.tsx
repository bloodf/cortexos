import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardAlias({
	params,
}: Readonly<{
	params: Promise<{ locale: string }>;
}>) {
	const { locale } = await params;
	redirect(`/${locale}/overview`);
}
