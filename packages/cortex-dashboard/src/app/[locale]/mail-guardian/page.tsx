import { MailGuardianPanel } from "@/components/admin/mail-guardian-panel";

export default function MailGuardianPage() {
	return (
		<div className="space-y-4">
			<div>
				<h1 className="text-2xl font-semibold">Mail Guardian</h1>
				<p className="text-sm text-muted-foreground">Manage watched email accounts and review queued email decisions.</p>
			</div>
			<MailGuardianPanel />
		</div>
	);
}

export const dynamic = "force-dynamic";
