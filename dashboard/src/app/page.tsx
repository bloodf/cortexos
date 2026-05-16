import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { routing } from "@/i18n/routing";

export default async function Home() {
	const headerList = await headers();
	const acceptLang = headerList.get("accept-language") ?? "";
	const preferred = acceptLang.split(",")[0]?.trim().toLowerCase().slice(0, 5);
	const locale = routing.locales.find(
		(l) => preferred.startsWith(l) || preferred.startsWith(l.split("-")[0]),
	) ?? routing.defaultLocale;
	redirect(`/${locale}/overview`);
}
