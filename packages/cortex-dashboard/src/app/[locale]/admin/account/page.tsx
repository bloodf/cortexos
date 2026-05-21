import { redirect } from "@/i18n/routing";
import { getCurrentSession } from "@/lib/auth";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

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
					<CardTitle>Password management</CardTitle>
					<CardDescription>
						Dashboard passwords are managed by Linux PAM.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-2 text-sm text-muted-foreground">
					<p>
						Use <code className="rounded bg-muted px-1 py-0.5 font-mono">passwd</code>, Cockpit,
						Webmin, or SSH to change your system account password.
					</p>
					<p>
						Admin rights require membership in <code className="rounded bg-muted px-1 py-0.5 font-mono">cortexos-admin</code> or <code className="rounded bg-muted px-1 py-0.5 font-mono">sudo</code>.
					</p>
				</CardContent>
			</Card>
		</div>
	);
}

export const dynamic = "force-dynamic";
