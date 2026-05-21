import { redirect } from "@/i18n/routing";

export default async function SetupPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect({ href: "/login", locale });
}

export const dynamic = "force-dynamic";
