import { redirect } from "@/i18n/routing";
import { Shield } from "lucide-react";
import { SetupForm } from "@/components/auth/setup-form";
import { countAdminUsers } from "@/lib/db/admin";

export default async function SetupPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const count = await countAdminUsers();
  if (count > 0) {
    redirect({ href: "/login", locale });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="glass-panel rounded-2xl p-8 w-full max-w-md">
        <div className="flex flex-col items-center gap-4 mb-8">
          <Shield className="w-12 h-12 text-indigo-400" />
          <h1 className="text-xl font-bold text-white/90 light:text-slate-800">
            First-time setup
          </h1>
          <p className="text-sm text-white/40 light:text-slate-500 text-center">
            Create first administrator account. Setup closes after one admin exists.
          </p>
        </div>
        <SetupForm />
      </div>
    </div>
  );
}

export const dynamic = "force-dynamic";
