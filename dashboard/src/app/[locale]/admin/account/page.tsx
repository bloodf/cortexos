import { redirect } from "@/i18n/routing";
import { getCurrentSession } from "@/lib/auth";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { ChangePasswordForm } from "@/components/auth/change-password-form";

export default async function AccountPage({
	params,
}: {
	params: Promise<{ locale: string }>;
}) {
	const { locale } = await params;
	const session = await getCurrentSession();
	if (!session) {
		redirect({ href: "/login", locale });
	}

	return (
		<div className="space-y-4">
			<div>
				<h1 className="text-2xl font-semibold">Account</h1>
				<p className="text-sm text-muted-foreground">
					Signed in as <span className="font-mono">{session!.user.username}</span>
				</p>
			</div>
			<Card>
				<CardHeader>
					<CardTitle>Change password</CardTitle>
					<CardDescription>
						Use a strong password of at least 8 characters. Changes take effect
						immediately; existing sessions remain valid.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<ChangePasswordForm />
				</CardContent>
			</Card>
		</div>
	);
}

export const dynamic = "force-dynamic";
