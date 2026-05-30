import { redirect } from "@/i18n/routing";

// Under PAM auth there is no DB-seeded admin and no first-time password setup;
// authentication is delegated to Linux PAM. This route always redirects to login.
export default async function SetupPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect({ href: "/login", locale });
}

export const dynamic = "force-dynamic";
