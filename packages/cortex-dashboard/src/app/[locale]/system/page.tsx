import { redirect } from "next/navigation";

export default async function SystemAlias({
	params,
}: Readonly<{
	params: Promise<{ locale: string }>;
}>) {
	const { locale } = await params;
	redirect(`/${locale}/storage`);
}
