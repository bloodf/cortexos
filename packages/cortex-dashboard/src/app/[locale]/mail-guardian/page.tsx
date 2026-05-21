import { MailGuardianReviewsPanel } from "@/components/admin/mail-guardian-reviews-panel";

export default function MailGuardianPage() {
	return (
		<div className="space-y-4">
			<div>
				<h1 className="text-2xl font-semibold">Mail Guardian</h1>
				<p className="text-sm text-muted-foreground">Review queued email decisions and execute owner actions.</p>
			</div>
			<MailGuardianReviewsPanel />
		</div>
	);
}

export const dynamic = "force-dynamic";
