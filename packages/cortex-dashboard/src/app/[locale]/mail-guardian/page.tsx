import { MailGuardianAccountsPanel } from "@/components/admin/mail-guardian-accounts-panel";
import { MailGuardianReviewsPanel } from "@/components/admin/mail-guardian-reviews-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function MailGuardianPage() {
	return (
		<div className="space-y-4">
			<div>
				<h1 className="text-2xl font-semibold">Mail Guardian</h1>
				<p className="text-sm text-muted-foreground">Manage watched email accounts and review queued email decisions.</p>
			</div>
			<Tabs defaultValue="accounts">
				<TabsList variant="line">
					<TabsTrigger value="accounts">Accounts</TabsTrigger>
					<TabsTrigger value="reviews">Reviews</TabsTrigger>
				</TabsList>
				<TabsContent value="accounts">
					<MailGuardianAccountsPanel />
				</TabsContent>
				<TabsContent value="reviews">
					<MailGuardianReviewsPanel />
				</TabsContent>
			</Tabs>
		</div>
	);
}

export const dynamic = "force-dynamic";
