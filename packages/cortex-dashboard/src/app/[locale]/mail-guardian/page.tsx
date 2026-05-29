import { MailGuardianPanel } from "@/components/admin/mail-guardian-panel";
import { PageHeader } from "@/components/ui/page-header";
import { MailCheckIcon } from "lucide-react";

export default function MailGuardianPage() {
	return (
		<div className="flex flex-col gap-6 p-6">
			<PageHeader
				title="Mail Guardian"
				description="Manage watched email accounts and review queued email decisions."
				icon={<MailCheckIcon />}
			/>
			<MailGuardianPanel />
		</div>
	);
}

export const dynamic = "force-dynamic";
