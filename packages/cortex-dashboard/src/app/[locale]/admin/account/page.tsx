import { redirect } from "@/i18n/routing";
import { getCurrentSession } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { UserCircle } from "lucide-react";

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
		<div className="flex flex-col gap-6 p-6">
			<PageHeader
				title="Account"
				description={
					<>
						Signed in as{" "}
						<span className="font-mono text-foreground">{session!.user.username}</span>
					</>
				}
				icon={<UserCircle />}
			/>
			<Card>
				<CardHeader>
					<CardTitle>Password</CardTitle>
					<CardDescription>
						Dashboard authentication is delegated to Linux PAM. Your password is
						the password of your host system account, so it cannot be changed here.
						Update it on the host with <span className="font-mono">passwd</span>,
						Cockpit, Webmin, or SSH. The change takes effect on your next login.
					</CardDescription>
				</CardHeader>
				<CardContent />
			</Card>
		</div>
	);
}

export const dynamic = "force-dynamic";
