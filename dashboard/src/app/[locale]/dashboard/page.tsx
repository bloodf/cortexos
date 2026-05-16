import { redirect } from "next/navigation";

export default async function DashboardAlias({
	params,
}: Readonly<{
	params: Promise<{ locale: string }>;
}>) {
	const { locale } = await params;
	redirect(`/${locale}/overview`);
}
