import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "System" };

export default async function SystemAlias({
	params,
}: Readonly<{
	params: Promise<{ locale: string }>;
}>) {
	const { locale } = await params;
	redirect(`/${locale}/storage`);
}
