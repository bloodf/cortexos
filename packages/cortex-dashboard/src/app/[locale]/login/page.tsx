import { Shield } from "lucide-react";
import { LoginForm } from "@/components/sys-pilot/auth/login-form";

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
	await params;
	return (
		<div className="min-h-screen flex items-center justify-center bg-background">
			<div className="glass-panel rounded-2xl p-8 w-full max-w-md">
				<div className="flex flex-col items-center gap-4 mb-8">
					<Shield className="w-12 h-12 text-indigo-400" />
					<h1 className="text-xl font-bold text-white/90 light:text-slate-800">
						Cortex Dashboard
					</h1>
					<p className="text-sm text-white/40 light:text-slate-500">
						Sign in to access administration
					</p>
				</div>
				<LoginForm />
			</div>
		</div>
	);
}

export const dynamic = "force-dynamic";
