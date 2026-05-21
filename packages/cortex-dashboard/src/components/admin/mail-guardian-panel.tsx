"use client";

import * as React from "react";
import { MailGuardianAccountsPanel } from "@/components/admin/mail-guardian-accounts-panel";
import { MailGuardianReviewsPanel } from "@/components/admin/mail-guardian-reviews-panel";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type MailGuardianTab = "accounts" | "reviews";

export function MailGuardianPanel() {
	const [tab, setTab] = React.useState<MailGuardianTab>("accounts");

	return (
		<div className="space-y-4">
			<Tabs value={tab} onValueChange={(value) => setTab(value as MailGuardianTab)}>
				<TabsList variant="line">
					<TabsTrigger value="accounts">Accounts</TabsTrigger>
					<TabsTrigger value="reviews">Reviews</TabsTrigger>
				</TabsList>
			</Tabs>
			{tab === "accounts" ? <MailGuardianAccountsPanel /> : <MailGuardianReviewsPanel />}
		</div>
	);
}
