"use client";

import { ShieldQuestion } from "lucide-react";
import { useEffect, useState } from "react";

interface MailGuardianStats {
	openReviews?: number;
}

export function MailGuardianReviewsWidget() {
	const [openReviews, setOpenReviews] = useState(0);

	useEffect(() => {
		let mounted = true;
		const load = () => {
			fetch("/api/mail-guardian")
				.then((res) => res.json())
				.then((data: MailGuardianStats) => {
					if (mounted) setOpenReviews(Number(data.openReviews ?? 0));
				})
				.catch(() => {});
		};
		load();
		const interval = setInterval(load, 10000);
		return () => {
			mounted = false;
			clearInterval(interval);
		};
	}, []);

	return (
		<div className="-m-4 flex h-[calc(100%+2rem)] min-h-[112px] items-center gap-3 rounded-2xl border border-warning/20 bg-warning/10 px-6 py-4">
			<ShieldQuestion className="size-7 text-warning" />
			<div>
				<div className="text-2xl font-bold text-warning">{openReviews}</div>
				<div className="text-xs text-muted-foreground">Mail Reviews</div>
			</div>
		</div>
	);
}
