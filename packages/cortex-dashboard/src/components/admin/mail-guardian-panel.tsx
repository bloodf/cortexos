"use client";

import * as React from "react";
import { MailGuardianAccountsPanel } from "@/components/admin/mail-guardian-accounts-panel";
import { MailGuardianReviewsPanel } from "@/components/admin/mail-guardian-reviews-panel";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type MailGuardianTab = "accounts" | "reviews";

export function MailGuardianPanel() {
	const [tab, setTab] = React.useState<MailGuardianTab>("reviews");

	return (
		<div className="space-y-4">
			<Tabs value={tab} onValueChange={(value) => setTab(value as MailGuardianTab)}>
				<TabsList variant="line">
					<TabsTrigger value="reviews">Reviews</TabsTrigger>
					<TabsTrigger value="accounts">Accounts</TabsTrigger>
				</TabsList>
			</Tabs>
			{tab === "reviews" ? <MailGuardianReviewsPanel /> : <MailGuardianAccountsPanel />}
		</div>
	);
}
