import { redirect } from "next/navigation";

// Renamed to /healthcheck per v1.0 plan §3.
export default async function ServicesPage({
	params,
}: Readonly<{
	params: Promise<{ locale: string }>;
}>) {
	const { locale } = await params;
	redirect(`/${locale}/healthcheck`);
}
